// Lógica de agrupamiento jerárquico (Empresa -> Cc/Local -> Fecha -> Orden)
// para el Data Grid de drill-down. Este módulo es puro (sin dependencia de
// Supabase): construye el árbol de filas a partir de datos planos a nivel de
// orden, ya normalizados por quien los obtiene (ver dashboard/drilldown/page.tsx).
//
// Cada agregador (Rappi, Pedidos Ya, Justo, Uber Eats) trae sus propias
// columnas de comisión/descuento en su Excel, así que las métricas NO son
// una lista fija: son una configuración por plataforma (ver PLATFORM_METRICS
// más abajo). Todo lo demás en este archivo (el árbol de 4 niveles, el
// agrupamiento, el formateo de fechas) es genérico y sirve para cualquier
// plataforma sin cambios.

// Las claves de métrica son específicas de cada plataforma (ej. Rappi usa
// "cuotaRappiAds"; otra plataforma tendrá las suyas), así que se tratan como
// string simple en vez de una unión fija de literales.
export type MetricKey = string;

// De dónde sale cada métrica: puede ser una de las columnas numéricas
// comunes de `orders` (gross_sales, platform_fee, etc. — el "mínimo común"
// que se espera parsear de cualquier agregador al importar su Excel), o
// vivir solo en la columna `raw` (jsonb con el encabezado original de esa
// plataforma como clave, valor guardado como texto).
export type MetricSource =
  | { kind: "column"; column: "platform_fee" | "platform_fee_tax" | "manual_adjustment" | "net_amount" }
  | { kind: "raw"; rawKey: string };

export interface MetricDef {
  key: MetricKey;
  /** Encabezado real de la hoja de origen (para tooltip). */
  label: string;
  /** Encabezado corto que cabe en la columna. */
  short: string;
  source: MetricSource;
  /** Resalta esta columna en el grid (ej. el total neto de la plataforma). */
  emphasize?: boolean;
}

export interface PlatformMetricsConfig {
  metrics: MetricDef[];
  /** Columnas que se muestran por defecto (vista compacta); el resto queda un clic atrás. */
  defaultVisible: MetricKey[];
}

const RAPPI_METRICS: MetricDef[] = [
  { key: "ventasBase", label: "Ventas base por Uso y alquiler de plataforma Rappi (informativo)", short: "Ventas base", source: { kind: "raw", rawKey: "Ventas base por Uso y alquiler de plataforma Rappi (informativo)" } },
  { key: "mealVouchers", label: "Meal Vouchers", short: "Meal Vouchers", source: { kind: "raw", rawKey: "Meal Vouchers" } },
  { key: "compensaciones", label: "Compensaciones", short: "Compensaciones", source: { kind: "raw", rawKey: "Compensaciones" } },
  { key: "usoAlquiler", label: "Uso y alquiler de plataforma Rappi", short: "Uso y alquiler", source: { kind: "column", column: "platform_fee" } },
  { key: "usoAlquilerPro", label: "Uso y Alquiler de plataforma Rappi para órdenes Pro", short: "Uso y alquiler Pro", source: { kind: "raw", rawKey: "Uso y Alquiler de plataforma Rappi para órdenes Pro" } },
  // Ojo: este encabezado trae doble espacio en el Excel original de Rappi ("Rappi  a aplicar").
  { key: "descuentoInversionDAR", label: "Descuento por inversión de Rappi a aplicar sobre Uso y alquiler de plataforma Rappi DAR", short: "Desc. inversión DAR", source: { kind: "raw", rawKey: "Descuento por inversión de Rappi  a aplicar sobre Uso y alquiler de plataforma Rappi DAR" } },
  { key: "cuotaRappiAds", label: "Cuota de RappiAds", short: "Cuota RappiAds", source: { kind: "raw", rawKey: "Cuota de RappiAds" } },
  { key: "ivaUsoAlquiler", label: "IVA Uso y alquiler de plataforma Rappi", short: "IVA uso y alquiler", source: { kind: "column", column: "platform_fee_tax" } },
  { key: "descuentoInversionIvaDAR", label: "Descuento por inversión de Rappi a aplicar sobre el IVA Uso y alquiler de plataforma Rappi DAR", short: "Desc. inversión IVA DAR", source: { kind: "raw", rawKey: "Descuento por inversión de Rappi a aplicar sobre el IVA Uso y alquiler de plataforma Rappi DAR" } },
  { key: "ivaRappiAds", label: "IVA Rappi Ads", short: "IVA RappiAds", source: { kind: "raw", rawKey: "IVA Rappi Ads" } },
  { key: "ajustesManuales", label: "Valor Ajustes Manuales", short: "Ajustes manuales", source: { kind: "column", column: "manual_adjustment" } },
  { key: "cashbackAsumido", label: "Cashback en Créditos de Rappi asumido por el aliado", short: "Cashback asumido", source: { kind: "raw", rawKey: "Cashback en Créditos de Rappi asumido por el aliado" } },
  { key: "reintegro35", label: "Reintegro 35%", short: "Reintegro 35%", source: { kind: "raw", rawKey: "Reintegro 35%" } },
  { key: "valorNeto", label: "Valor Neto", short: "Valor neto", source: { kind: "column", column: "net_amount" }, emphasize: true },
];

const RAPPI_DEFAULT_VISIBLE: MetricKey[] = [
  "ventasBase",
  "compensaciones",
  "usoAlquiler",
  "ivaUsoAlquiler",
  "ajustesManuales",
  "cashbackAsumido",
  "valorNeto",
];

/**
 * Registro de métricas por plataforma (slug de la tabla `platforms`). Cuando
 * se suba el primer Excel de Pedidos Ya/Justo/Uber Eats, se agrega su propia
 * entrada acá (con sus propios encabezados) — el resto de este archivo, el
 * grid y la página de desglose no necesitan cambiar.
 */
export const PLATFORM_METRICS: Record<string, PlatformMetricsConfig> = {
  rappi: { metrics: RAPPI_METRICS, defaultVisible: RAPPI_DEFAULT_VISIBLE },
};

export function getPlatformMetrics(slug: string): PlatformMetricsConfig | null {
  return PLATFORM_METRICS[slug] ?? null;
}

export type Metrics = Record<MetricKey, number>;

export interface OrderLeaf {
  empresa: string;
  cc: string;
  local: string;
  /** Fecha ISO (yyyy-mm-dd) de la orden, según la plataforma de origen. */
  fecha: string;
  ordenId: string;
  metrics: Metrics;
}

interface BaseRow {
  id: string;
  metrics: Metrics;
}

export interface EmpresaRow extends BaseRow {
  level: 1;
  empresa: string;
  orderCount: number;
  subRows: LocalRow[];
}

export interface LocalRow extends BaseRow {
  level: 2;
  cc: string;
  local: string;
  orderCount: number;
  subRows: FechaRow[];
}

export interface FechaRow extends BaseRow {
  level: 3;
  fecha: string;
  orderCount: number;
  subRows: OrdenRow[];
}

export interface OrdenRow extends BaseRow {
  level: 4;
  ordenId: string;
  subRows?: undefined;
}

export type HierarchyRow = EmpresaRow | LocalRow | FechaRow | OrdenRow;

function emptyMetrics(metricDefs: MetricDef[]): Metrics {
  const m: Metrics = {};
  for (const def of metricDefs) m[def.key] = 0;
  return m;
}

function sumMetrics(list: Metrics[], metricDefs: MetricDef[]): Metrics {
  const total = emptyMetrics(metricDefs);
  for (const metrics of list) {
    for (const def of metricDefs) total[def.key] += metrics[def.key] ?? 0;
  }
  return total;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

const fechaLongFormat = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** `fecha` es una fecha ISO (yyyy-mm-dd); se formatea siempre en UTC. */
export function formatFechaLong(fecha: string): string {
  return fechaLongFormat.format(new Date(`${fecha}T00:00:00Z`));
}

/**
 * Construye el árbol de 4 niveles a partir de órdenes planas.
 * Niveles 1-3 llevan la suma de cada métrica; el nivel 4 (hoja) lleva el
 * valor exacto de esa orden — no se agrega, así que no requiere lógica extra.
 * `metricDefs` es la lista de métricas de la plataforma de esas órdenes
 * (ver PLATFORM_METRICS) — define qué claves tiene el objeto `metrics` de
 * cada fila agregada.
 */
export function buildHierarchy(orders: OrderLeaf[], metricDefs: MetricDef[]): EmpresaRow[] {
  const byEmpresa = groupBy(orders, (o) => o.empresa);

  return Array.from(byEmpresa.entries())
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([empresa, empresaOrders]) => {
      const byLocal = groupBy(empresaOrders, (o) => `${o.cc}\u0000${o.local}`);

      const locales: LocalRow[] = Array.from(byLocal.entries())
        .map(([localKey, localOrders]) => {
          const [cc, local] = localKey.split("\u0000");
          const byFecha = groupBy(localOrders, (o) => o.fecha);

          const fechas: FechaRow[] = Array.from(byFecha.entries())
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([fecha, fechaOrders]) => {
              const ordenes: OrdenRow[] = fechaOrders
                .slice()
                .sort((a, b) => a.ordenId.localeCompare(b.ordenId))
                .map((o) => ({
                  id: `orden:${o.ordenId}`,
                  level: 4,
                  ordenId: o.ordenId,
                  metrics: o.metrics,
                }));

              return {
                id: `fecha:${empresa}:${cc}:${local}:${fecha}`,
                level: 3,
                fecha,
                orderCount: fechaOrders.length,
                metrics: sumMetrics(fechaOrders.map((o) => o.metrics), metricDefs),
                subRows: ordenes,
              };
            });

          return {
            id: `local:${empresa}:${cc}:${local}`,
            level: 2 as const,
            cc,
            local,
            orderCount: localOrders.length,
            metrics: sumMetrics(localOrders.map((o) => o.metrics), metricDefs),
            subRows: fechas,
          };
        })
        .sort((a, b) => a.local.localeCompare(b.local, "es"));

      return {
        id: `empresa:${empresa}`,
        level: 1,
        empresa,
        orderCount: empresaOrders.length,
        metrics: sumMetrics(empresaOrders.map((o) => o.metrics), metricDefs),
        subRows: locales,
      };
    });
}

/** Convierte un valor de la columna `raw` (texto plano, ej. "-2078.4", "0") a número. */
export function parseRawMetricNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (s === "" || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Convierte una fecha guardada en `raw` al formato ISO (yyyy-mm-dd) en UTC.
 * Si el importador la guardó como el texto que produce `String(new Date(...))`
 * (ej. "Wed Aug 26 2026 00:00:00 GMT+0000 (Coordinated Universal Time)",
 * como hace Rappi con "Fecha_Original_Rappi"), `new Date(...)` la reconoce
 * directamente. Devuelve null si no se pudo leer.
 */
export function parseRawDateToISO(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

interface OrderRecordForMetrics {
  platform_fee: number | string | null;
  platform_fee_tax: number | string | null;
  manual_adjustment: number | string | null;
  net_amount: number | string | null;
  raw: Record<string, unknown> | null;
}

/** Arma el registro de métricas de una orden combinando columnas tipadas + `raw`. */
export function extractMetrics(row: OrderRecordForMetrics, metricDefs: MetricDef[]): Metrics {
  const metrics = emptyMetrics(metricDefs);
  for (const def of metricDefs) {
    if (def.source.kind === "column") {
      metrics[def.key] = parseRawMetricNumber(row[def.source.column]);
    } else {
      metrics[def.key] = parseRawMetricNumber(row.raw?.[def.source.rawKey]);
    }
  }
  return metrics;
}
