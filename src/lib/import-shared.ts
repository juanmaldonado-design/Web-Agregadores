/**
 * Utilidades compartidas entre los importadores de Excel de cada agregador
 * (Rappi hoy; Pedidos Ya/Justo/Uber Eats después). Cada plataforma trae su
 * propio layout de columnas, así que el mapeo de columnas vive en el
 * importador de cada una (ver rappi-import.ts) — lo que es genuinamente
 * igual entre todas (leer celdas de ExcelJS, resolver la empresa/tienda
 * contra Supabase, adivinar el período desde el nombre del archivo) vive acá
 * para no reescribirlo cada vez.
 */
import ExcelJS from "exceljs";
import { supabaseAdmin } from "./supabase-admin";

/** Fila donde suelen venir los encabezados en estos exports (ajustable si alguna plataforma usa otra). */
export const DEFAULT_HEADER_ROW = 2;
/** Primera fila de datos (justo debajo del encabezado). */
export const DEFAULT_DATA_START_ROW = 3;

// Las 5 empresas reales son las mismas sin importar el agregador; cada
// plataforma solo varía en cómo escribe el nombre/código en su Excel
// ("Resumen Cuadratura" de Rappi usa códigos cortos, "Consolidado Semanal"
// la razón social completa, otra plataforma puede traer otra variante más).
// Se agregan alias nuevos acá a medida que aparecen, no se duplica la lista
// por plataforma.
export const COMPANY_ALIASES: Record<string, string> = {
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

export function headerMap(sheet: ExcelJS.Worksheet, headerRow: number = DEFAULT_HEADER_ROW): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(headerRow);
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const value = String(cell.value ?? "").trim();
    if (value) map.set(value, colNumber);
  });
  return map;
}

export function cellText(row: ExcelJS.Row, col?: number): string | null {
  if (!col) return null;
  const v = row.getCell(col).value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "").trim() || null;
  }
  return String(v).trim() || null;
}

export function cellNumber(row: ExcelJS.Row, col?: number): number {
  if (!col) return 0;
  const v = row.getCell(col).value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in (v as object)) {
    const r = (v as { result: unknown }).result;
    return typeof r === "number" ? r : 0;
  }
  return 0;
}

export function cellDate(row: ExcelJS.Row, col?: number): Date | null {
  if (!col) return null;
  const v = row.getCell(col).value;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    // formato dd-mm-yyyy, usado por ejemplo en "Resumen Cuadratura" de Rappi
    const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function isPlausibleDate(raw: string): boolean {
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/**
 * Busca dos fechas AAAAMMDD en el nombre del archivo (el separador varía
 * según cómo se haya guardado/renombrado: _, espacios, corchetes, etc.).
 * Sirve de base para cualquier plataforma que nombre sus exports así; si
 * alguna no lo hace, su importador puede resolver el período de otra forma.
 */
export function periodFromFileName(fileName: string): { start: string; end: string } {
  const candidates = (fileName.match(/\d{8}/g) ?? []).filter(isPlausibleDate);
  if (candidates.length < 2) {
    throw new Error(
      `No se pudo extraer el período del nombre del archivo "${fileName}". Debe contener dos fechas en formato AAAAMMDD, ej. 20260831 y 20260906.`
    );
  }
  const toIso = (raw: string) => `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  return { start: toIso(candidates[0]), end: toIso(candidates[1]) };
}

export function weekLabelFromFileName(fileName: string): string | null {
  const match = fileName.match(/SEM\s*0*(\d{1,2})/i);
  return match ? `SEM${match[1]}` : null;
}

export async function resolveCompanyId(rawName: string | null, warnings: string[]): Promise<number | null> {
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

export async function resolveStoreId(
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

/** Inserta en bloques de `chunkSize` para no exceder límites de la API de Supabase. */
export async function insertInChunks(
  table: string,
  rows: Record<string, unknown>[],
  chunkSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabaseAdmin.from(table).insert(chunk);
    if (error) throw error;
  }
}

/**
 * Si ya existía un import de esta plataforma+semana, lo borra (cascada a
 * orders/weekly_summary) y crea uno nuevo — así volver a subir el mismo
 * archivo reemplaza los datos en vez de duplicarlos. Común a cualquier
 * plataforma que importe por período semanal.
 */
export async function replaceImport(
  platformId: number,
  fileName: string,
  periodStart: string,
  periodEnd: string
): Promise<string> {
  const { error: deleteError } = await supabaseAdmin
    .from("imports")
    .delete()
    .eq("platform_id", platformId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);
  if (deleteError) throw deleteError;

  const { data: importRow, error: importError } = await supabaseAdmin
    .from("imports")
    .insert({ platform_id: platformId, file_name: fileName, period_start: periodStart, period_end: periodEnd })
    .select("id")
    .single();
  if (importError || !importRow) throw importError ?? new Error("No se pudo crear el registro de import");
  return importRow.id as string;
}

export async function getPlatformId(slug: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from("platforms").select("id").eq("slug", slug).single();
  if (error || !data) throw error ?? new Error(`Plataforma '${slug}' no encontrada`);
  return data.id as number;
}
