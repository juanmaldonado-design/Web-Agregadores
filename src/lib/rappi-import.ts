/**
 * Lógica de importación del Excel de conciliación semanal de Rappi
 * (hojas "Consolidado Semanal" y "Resumen Cuadratura") hacia Supabase.
 *
 * La usan tanto scripts/import-rappi.ts (línea de comandos) como
 * src/app/api/import/rappi/route.ts (subida desde la web).
 */
import ExcelJS from "exceljs";
import { supabaseAdmin } from "./supabase-admin";

const ORDERS_SHEET = "Consolidado Semanal";
const SUMMARY_SHEET = "Resumen Cuadratura";
const HEADER_ROW = 2;
const DATA_START_ROW = 3;

// La hoja "Resumen Cuadratura" usa códigos cortos; "Consolidado Semanal" usa la
// razón social completa. Mapeamos ambos a la misma fila de `companies`.
const COMPANY_ALIASES: Record<string, string> = {
  "ADMINISTRADORA ARBAL LTDA.": "ADMINISTRADORA ARBAL LTDA.",
  ARBAL: "ADMINISTRADORA ARBAL LTDA.",
  "AVICOLA MONTSERRAT LTDA.": "AVICOLA MONTSERRAT LTDA.",
  AVICOLA: "AVICOLA MONTSERRAT LTDA.",
  "COMERCIAL JUAN BATLLE LTDA.": "COMERCIAL JUAN BATLLE LTDA.",
  CJB: "COMERCIAL JUAN BATLLE LTDA.",
  "COMERCIAL TARRAGONA S.A.": "COMERCIAL TARRAGONA S.A.",
  TARRAGONA: "COMERCIAL TARRAGONA S.A.",
  "DISTRIBUIDORA MONTSERRAT LTDA.": "DISTRIBUIDORA MONTSERRAT LTDA.",
  DISTRIBUIDORA: "DISTRIBUIDORA MONTSERRAT LTDA.",
};

export interface RappiImportResult {
  fileName: string;
  weekLabel: string | null;
  periodStart: string;
  periodEnd: string;
  ordersImported: number;
  summaryRowsImported: number;
  warnings: string[];
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(HEADER_ROW);
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const value = String(cell.value ?? "").trim();
    if (value) map.set(value, colNumber);
  });
  return map;
}

function cellText(row: ExcelJS.Row, col?: number): string | null {
  if (!col) return null;
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "").trim() || null;
  }
  return String(v).trim() || null;
}

function cellNumber(row: ExcelJS.Row, col?: number): number {
  if (!col) return 0;
  const v = row.getCell(col).value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in (v as object)) {
    const r = (v as { result: unknown }).result;
    return typeof r === "number" ? r : 0;
  }
  return 0;
}

function cellDate(row: ExcelJS.Row, col?: number): Date | null {
  if (!col) return null;
  const v = row.getCell(col).value;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    // formato dd-mm-yyyy usado en "Resumen Cuadratura"
    const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
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

function isPlausibleDate(raw: string): boolean {
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function periodFromFileName(fileName: string): { start: string; end: string } {
  // El nombre trae dos fechas AAAAMMDD, pero el separador varía según cómo
  // se haya guardado/renombrado el archivo (_, espacios, corchetes, etc.),
  // así que buscamos cualquier par de secuencias de 8 dígitos que parezcan fechas.
  const candidates = (fileName.match(/\d{8}/g) ?? []).filter(isPlausibleDate);
  if (candidates.length < 2) {
    throw new Error(
      `No se pudo extraer el período del nombre del archivo "${fileName}". Debe contener dos fechas en formato AAAAMMDD, ej. 20260831 y 20260906.`
    );
  }
  const toIso = (raw: string) => `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return { start: toIso(candidates[0]), end: toIso(candidates[1]) };
}

function weekLabelFromFileName(fileName: string): string | null {
  const match = fileName.match(/SEM\s*0*(\d{1,2})/i);
  return match ? `SEM${match[1]}` : null;
}

async function resolveCompanyId(rawName: string | null, warnings: string[]): Promise<number | null> {
  if (!rawName) return null;
  const canonical = COMPANY_ALIASES[rawName.trim().toUpperCase()] ?? COMPANY_ALIASES[rawName.trim()];
  if (!canonical) {
    warnings.push(`Empresa no reconocida: "${rawName}" (se dejó sin asignar)`);
    return null;
  }
  const { data, error } = await supabaseAdmin.from("companies").select("id").eq("name", canonical).single();
  if (error || !data) {
    warnings.push(`No se encontró en la tabla companies: "${canonical}"`);
    return null;
  }
  return data.id as number;
}

async function resolveStoreId(
  platformId: number,
  companyId: number | null,
  externalStoreId: string | null,
  name: string | null,
  localName: string | null,
  costCenter: string | null,
  warnings: string[]
): Promise<string | null> {
  if (!externalStoreId) return null;
  const { data, error } = await supabaseAdmin
    .from("stores")
    .upsert(
      {
        platform_id: platformId,
        company_id: companyId,
        external_store_id: externalStoreId,
        name: name ?? externalStoreId,
        local_name: localName,
        cost_center: costCenter,
      },
      { onConflict: "platform_id,external_store_id" }
    )
    .select("id")
    .single();
  if (error || !data) {
    warnings.push(`No se pudo crear/actualizar la tienda ${externalStoreId}: ${error?.message}`);
    return null;
  }
  return data.id as string;
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
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin.from("orders").insert(chunk);
    if (error) throw error;
  }

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

  const { data: platform, error: platformError } = await supabaseAdmin
    .from("platforms")
    .select("id")
    .eq("slug", "rappi")
    .single();
  if (platformError || !platform) throw platformError ?? new Error("Plataforma 'rappi' no encontrada");
  const platformId = platform.id as number;

  // Si ya se había subido un archivo para esta misma plataforma+semana, se
  // borra ese import anterior (y en cascada sus orders/weekly_summary) para
  // que volver a subir el mismo archivo reemplace los datos en vez de sumarlos.
  const { error: deleteError } = await supabaseAdmin
    .from("imports")
    .delete()
    .eq("platform_id", platformId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);
  if (deleteError) throw deleteError;

  const { data: importRow, error: importError } = await supabaseAdmin
    .from("imports")
    .insert({
      platform_id: platformId,
      file_name: fileName,
      period_start: periodStart,
      period_end: periodEnd,
    })
    .select("id")
    .single();
  if (importError || !importRow) throw importError ?? new Error("No se pudo crear el registro de import");
  const importId = importRow.id as string;

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
