/**
 * Importa el Excel de conciliación semanal de Rappi (hojas "Consolidado Semanal"
 * y "Resumen Cuadratura") a Supabase.
 *
 * Uso:
 *   npx tsx scripts/import-rappi.ts "ruta/al/SEM36_20260831_20260906_RAPPI....xlsx"
 */
import "dotenv/config";
import ExcelJS from "exceljs";
import path from "node:path";
import { supabaseAdmin } from "../src/lib/supabase-admin";

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

function periodFromFileName(fileName: string): { start: string; end: string } {
  const match = fileName.match(/(\d{8})_(\d{8})/);
  if (!match) {
    throw new Error(
      `No pude extraer el período del nombre del archivo "${fileName}". Se espera algo como SEM36_20260831_20260906_....xlsx`
    );
  }
  const toIso = (raw: string) => `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return { start: toIso(match[1]), end: toIso(match[2]) };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: npx tsx scripts/import-rappi.ts <ruta-al-excel>");
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  const { start: periodStart, end: periodEnd } = periodFromFileName(fileName);

  const { data: platform, error: platformError } = await supabaseAdmin
    .from("platforms")
    .select("id")
    .eq("slug", "rappi")
    .single();
  if (platformError || !platform) throw platformError ?? new Error("Plataforma 'rappi' no encontrada");
  const platformId = platform.id as number;

  console.log(`Leyendo ${fileName} (período ${periodStart} → ${periodEnd})...`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

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

  await importOrders(workbook, platformId, importId);
  await importWeeklySummary(workbook, platformId, importId, periodStart, periodEnd);

  console.log("Importación completa.");
}

async function resolveCompanyId(rawName: string | null): Promise<number | null> {
  if (!rawName) return null;
  const canonical = COMPANY_ALIASES[rawName.trim().toUpperCase()] ?? COMPANY_ALIASES[rawName.trim()];
  if (!canonical) {
    console.warn(`Empresa no reconocida: "${rawName}" (se deja sin asignar)`);
    return null;
  }
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("name", canonical)
    .single();
  if (error || !data) {
    console.warn(`No se encontró en la tabla companies: "${canonical}"`);
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
  costCenter: string | null
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
    console.warn(`No se pudo crear/actualizar la tienda ${externalStoreId}: ${error?.message}`);
    return null;
  }
  return data.id as string;
}

async function importOrders(workbook: ExcelJS.Workbook, platformId: number, importId: string) {
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
        companyCache.set(empresaRaw, await resolveCompanyId(empresaRaw));
      }
      companyId = companyCache.get(empresaRaw) ?? null;
    }

    const externalStoreId = cellText(row, col("ID de la tienda"));
    const storeName = cellText(row, col("Nombre de la tienda"));
    const localName = cellText(row, col("Local"));
    const costCenter = cellText(row, col("Cc"));
    let storeId: string | null = null;
    if (externalStoreId) {
      const storeKey = `${externalStoreId}`;
      if (!storeCache.has(storeKey)) {
        storeCache.set(
          storeKey,
          await resolveStoreId(platformId, companyId, externalStoreId, storeName, localName, costCenter)
        );
      }
      storeId = storeCache.get(storeKey) ?? null;
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
      order_created_at: cellDate(row, col("Fecha de creación orden")),
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

  console.log(`Insertando ${rows.length} pedidos...`);
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin
      .from("orders")
      .upsert(chunk, { onConflict: "platform_id,external_order_id" });
    if (error) throw error;
    console.log(`  ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }
}

async function importWeeklySummary(
  workbook: ExcelJS.Workbook,
  platformId: number,
  importId: string,
  periodStart: string,
  periodEnd: string
) {
  const sheet = workbook.getWorksheet(SUMMARY_SHEET);
  if (!sheet) {
    console.warn(`No se encontró la hoja "${SUMMARY_SHEET}", se omite el resumen.`);
    return;
  }
  const cols = headerMap(sheet);
  const col = (name: string) => cols.get(name);

  const rows: Record<string, unknown>[] = [];

  for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const empresaRaw = cellText(row, col("Empresa"));
    if (!empresaRaw) continue;

    const companyId = await resolveCompanyId(empresaRaw);
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

  console.log(`Insertando ${rows.length} filas de resumen semanal...`);
  const { error } = await supabaseAdmin
    .from("weekly_summary")
    .upsert(rows, { onConflict: "platform_id,company_id,period_start,period_end,tipo_local" });
  if (error) throw error;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
