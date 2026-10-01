/**
 * Lógica de importación del Excel de conciliación semanal de Rappi
 * (hojas "Consolidado Semanal" y "Resumen Cuadratura") hacia Supabase.
 *
 * La usan tanto scripts/import-rappi.ts (línea de comandos) como
 * src/app/api/import/rappi/route.ts (subida desde la web).
 *
 * Lo que es específico de Rappi vive acá: nombres de hoja, columnas, y el
 * parseo de su fecha en texto en español. Lo genérico (leer celdas,
 * resolver empresa/tienda, reemplazar un import al resubir) vive en
 * import-shared.ts — el importador de la próxima plataforma reutiliza eso
 * y solo define su propio mapeo de columnas.
 */
import ExcelJS from "exceljs";
import { supabaseAdmin } from "./supabase-admin";
import {
  cellDate,
  cellNumber,
  cellText,
  getPlatformId,
  headerMap,
  insertInChunks,
  periodFromFileName,
  replaceImport,
  resolveCompanyId,
  resolveStoreId,
  weekLabelFromFileName,
} from "./import-shared";

const PLATFORM_SLUG = "rappi";
const ORDERS_SHEET = "Consolidado Semanal";
const SUMMARY_SHEET = "Resumen Cuadratura";
const DATA_START_ROW = 3;

export interface RappiImportResult {
  fileName: string;
  weekLabel: string | null;
  periodStart: string;
  periodEnd: string;
  ordersImported: number;
  summaryRowsImported: number;
  warnings: string[];
}

const SPANISH_MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

// "Fecha de creación orden" viene como texto en español, ej.
// "lun. 31 ago. 2026, 9:37:36 a. m." o "mar. 01 sept. 2026, 10:14:37 a. m."
// Se guarda como si fuera UTC (ignorando la zona horaria real) para que la
// fecha/hora quede exactamente igual a la del Excel al leerla de vuelta con
// getUTC*/toISOString — no para comparar con otras zonas horarias.
function parseSpanishOrderDateTime(row: ExcelJS.Row, col?: number): Date | null {
  if (!col) return null;
  const v = row.getCell(col).value;
  if (v instanceof Date) return v;
  if (typeof v !== "string") return null;

  const m = v
    .trim()
    .match(
      /^\S+\.?\s+(\d{1,2})\s+([a-záéíóúñ]+)\.?\s+(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(a|p)\.?\s*m\.?$/i
    );
  if (!m) return null;

  const [, dayStr, monthStr, yearStr, hourStr, minuteStr, secondStr, ampm] = m;
  const month = SPANISH_MONTHS[monthStr.toLowerCase()];
  if (!month) return null;

  let hour = parseInt(hourStr, 10) % 12;
  if (ampm.toLowerCase() === "p") hour += 12;

  return new Date(
    Date.UTC(parseInt(yearStr, 10), month - 1, parseInt(dayStr, 10), hour, parseInt(minuteStr, 10), parseInt(secondStr, 10))
  );
}

async function importOrders(
  workbook: ExcelJS.Workbook,
  platformId: number,
  importId: string,
  warnings: string[]
): Promise<number> {
  const sheet = workbook.getWorksheet(ORDERS_SHEET);
  if (!sheet) throw new Error(`No se encontró la hoja "${ORDERS_SHEET}"`);
  const cols = headerMap(sheet);
  const col = (name: string) => cols.get(name);

  const companyCache = new Map<string, number | null>();
  const storeCache = new Map<string, string | null>();
  const rows: Record<string, unknown>[] = [];

  for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const externalOrderId = cellText(row, col("ID de la órden"));
    if (!externalOrderId) continue; // fila vacía / totales

    const empresaRaw = cellText(row, col("Empresa"));
    let companyId: number | null = null;
    if (empresaRaw) {
      if (!companyCache.has(empresaRaw)) {
        companyCache.set(empresaRaw, await resolveCompanyId(empresaRaw, warnings));
      }
      companyId = companyCache.get(empresaRaw) ?? null;
    }

    const externalStoreId = cellText(row, col("ID de la tienda"));
    const storeName = cellText(row, col("Nombre de la tienda"));
    const localName = cellText(row, col("Local"));
    const costCenter = cellText(row, col("Cc"));
    let storeId: string | null = null;
    if (externalStoreId) {
      if (!storeCache.has(externalStoreId)) {
        storeCache.set(
          externalStoreId,
          await resolveStoreId(platformId, companyId, externalStoreId, storeName, localName, costCenter, warnings)
        );
      }
      storeId = storeCache.get(externalStoreId) ?? null;
    }

    const raw: Record<string, unknown> = {};
    cols.forEach((colNumber, header) => {
      raw[header] = cellText(row, colNumber);
    });

    rows.push({
      import_id: importId,
      platform_id: platformId,
      company_id: companyId,
      store_id: storeId,
      external_order_id: externalOrderId,
      paidlot_id: cellText(row, col("ID del paidlot")),
      order_created_at: parseSpanishOrderDateTime(row, col("Fecha de creación orden")),
      transaction_type: cellText(row, col("Tipo de transacción")),
      order_status: cellText(row, col("Estado de la órden")),
      gross_sales: cellNumber(row, col("Venta Bruta")),
      platform_fee: cellNumber(row, col("Uso y alquiler de plataforma Rappi")),
      platform_fee_tax: cellNumber(row, col("IVA Uso y alquiler de plataforma Rappi")),
      manual_adjustment: cellNumber(row, col("Valor Ajustes Manuales")),
      net_amount: cellNumber(row, col("Valor Neto")),
      raw,
    });
  }

  // No se usa upsert: el "ID de la órden" de Rappi no es único por fila (un
  // mismo pedido puede traer una línea 'ORDEN' y otra 'COMPENSACIÓN', a veces
  // más de una). La idempotencia de re-subir el mismo archivo se logra
  // borrando el import anterior del mismo período antes de insertar.
  await insertInChunks("orders", rows);
  return rows.length;
}

async function importWeeklySummary(
  workbook: ExcelJS.Workbook,
  platformId: number,
  importId: string,
  periodStart: string,
  periodEnd: string,
  warnings: string[]
): Promise<number> {
  const sheet = workbook.getWorksheet(SUMMARY_SHEET);
  if (!sheet) {
    warnings.push(`No se encontró la hoja "${SUMMARY_SHEET}", se omitió el resumen ejecutivo.`);
    return 0;
  }
  const cols = headerMap(sheet);
  const col = (name: string) => cols.get(name);
  const rows: Record<string, unknown>[] = [];

  for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empresaRaw = cellText(row, col("Empresa"));
    if (!empresaRaw) continue;

    const companyId = await resolveCompanyId(empresaRaw, warnings);
    if (!companyId) continue;

    rows.push({
      import_id: importId,
      platform_id: platformId,
      company_id: companyId,
      period_start: periodStart,
      period_end: periodEnd,
      tipo_local: cellText(row, col("Tipo Local")),
      estado: cellText(row, col("Estado")),
      monto_a_depositar: cellNumber(row, col("Rappi a Depositar")),
      banco_recibido: cellNumber(row, col("Banco Recibido")),
      monto_a_facturar_neto: cellNumber(row, col("Rappi a Facturar (Neto)")),
      facturado_xml_neto: cellNumber(row, col("Facturado XML (Neto)")),
      fecha_pago: cellDate(row, col("Fecha de Pago"))?.toISOString().slice(0, 10) ?? null,
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabaseAdmin
    .from("weekly_summary")
    .upsert(rows, { onConflict: "platform_id,company_id,period_start,period_end,tipo_local" });
  if (error) throw error;

  return rows.length;
}

export async function importRappiWorkbook(
  workbook: ExcelJS.Workbook,
  fileName: string
): Promise<RappiImportResult> {
  const { start: periodStart, end: periodEnd } = periodFromFileName(fileName);
  const weekLabel = weekLabelFromFileName(fileName);
  const warnings: string[] = [];

  const platformId = await getPlatformId(PLATFORM_SLUG);
  const importId = await replaceImport(platformId, fileName, periodStart, periodEnd);

  const ordersImported = await importOrders(workbook, platformId, importId, warnings);
  const summaryRowsImported = await importWeeklySummary(
    workbook,
    platformId,
    importId,
    periodStart,
    periodEnd,
    warnings
  );

  return { fileName, weekLabel, periodStart, periodEnd, ordersImported, summaryRowsImported, warnings };
}
