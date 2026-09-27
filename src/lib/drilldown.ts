// Lógica de agrupamiento jerárquico (Empresa -> Cc/Local -> Fecha -> Orden)
// para el Data Grid de drill-down. Este módulo es puro (sin React): construye
// el árbol de filas a partir de datos planos a nivel de orden.

export interface MetricDef {
  key: MetricKey;
  /** Encabezado completo, tal como lo entrega Rappi (se usa como title/tooltip). */
  label: string;
  /** Encabezado corto que cabe en la columna. */
  short: string;
}

export type MetricKey =
  | "ventasBase"
  | "mealVouchers"
  | "compensaciones"
  | "usoAlquiler"
  | "usoAlquilerPro"
  | "descuentoInversionDAR"
  | "cuotaRappiAds"
  | "ivaUsoAlquiler"
  | "descuentoInversionIvaDAR"
  | "ivaRappiAds"
  | "ajustesManuales"
  | "cashbackAsumido"
  | "reintegro35"
  | "valorNeto";

export const METRICS: MetricDef[] = [
  { key: "ventasBase", label: "Suma de Ventas base por Uso y alquiler de plataforma Rappi (informativo)", short: "Ventas base" },
  { key: "mealVouchers", label: "Suma de Meal Vouchers", short: "Meal Vouchers" },
  { key: "compensaciones", label: "Suma de Compensaciones", short: "Compensaciones" },
  { key: "usoAlquiler", label: "Suma de Uso y alquiler de plataforma Rappi", short: "Uso y alquiler" },
  { key: "usoAlquilerPro", label: "Suma de Uso y Alquiler de plataforma Rappi para órdenes Pro", short: "Uso y alquiler Pro" },
  { key: "descuentoInversionDAR", label: "Suma de Descuento por inversión de Rappi a aplicar sobre Uso y alquiler de plataforma Rappi DAR", short: "Desc. inversión DAR" },
  { key: "cuotaRappiAds", label: "Suma de Cuota de RappiAds", short: "Cuota RappiAds" },
  { key: "ivaUsoAlquiler", label: "Suma de IVA Uso y alquiler de plataforma Rappi", short: "IVA uso y alquiler" },
  { key: "descuentoInversionIvaDAR", label: "Suma de Descuento por inversión de Rappi a aplicar sobre el IVA Uso y alquiler de plataforma Rappi DAR", short: "Desc. inversión IVA DAR" },
  { key: "ivaRappiAds", label: "Suma de IVA Rappi Ads", short: "IVA RappiAds" },
  { key: "ajustesManuales", label: "Suma de Valor Ajustes Manuales", short: "Ajustes manuales" },
  { key: "cashbackAsumido", label: "Suma de Cashback en Créditos de Rappi asumido por el aliado", short: "Cashback asumido" },
  { key: "reintegro35", label: "Suma de Reintegro 35%", short: "Reintegro 35%" },
  { key: "valorNeto", label: "Suma de Valor Neto", short: "Valor neto" },
];

export type Metrics = Record<MetricKey, number>;

export interface OrderLeaf {
  empresa: string;
  cc: string;
  local: string;
  /** Formato dd-mm-yyyy, tal como lo entrega el export de Rappi. */
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

function emptyMetrics(): Metrics {
  const m = {} as Metrics;
  for (const def of METRICS) m[def.key] = 0;
  return m;
}

function sumMetrics(list: Metrics[]): Metrics {
  const total = emptyMetrics();
  for (const metrics of list) {
    for (const def of METRICS) total[def.key] += metrics[def.key];
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

export function parseFechaDDMMYYYY(fecha: string): Date {
  const [d, m, y] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fechaLongFormat = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatFechaLong(fecha: string): string {
  return fechaLongFormat.format(parseFechaDDMMYYYY(fecha));
}

/**
 * Construye el árbol de 4 niveles a partir de órdenes planas.
 * Niveles 1-3 llevan la suma de cada métrica; el nivel 4 (hoja) lleva el
 * valor exacto de esa orden — no se agrega, así que no requiere lógica extra.
 */
export function buildHierarchy(orders: OrderLeaf[]): EmpresaRow[] {
  const byEmpresa = groupBy(orders, (o) => o.empresa);

  return Array.from(byEmpresa.entries()).map(([empresa, empresaOrders]) => {
    const byLocal = groupBy(empresaOrders, (o) => `${o.cc}\u0000${o.local}`);

    const locales: LocalRow[] = Array.from(byLocal.entries()).map(([localKey, localOrders]) => {
      const [cc, local] = localKey.split("\u0000");
      const byFecha = groupBy(localOrders, (o) => o.fecha);

      const fechas: FechaRow[] = Array.from(byFecha.entries())
        .sort(([a], [b]) => parseFechaDDMMYYYY(a).getTime() - parseFechaDDMMYYYY(b).getTime())
        .map(([fecha, fechaOrders]) => {
          const ordenes: OrdenRow[] = fechaOrders.map((o) => ({
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
            metrics: sumMetrics(fechaOrders.map((o) => o.metrics)),
            subRows: ordenes,
          };
        });

      return {
        id: `local:${empresa}:${cc}:${local}`,
        level: 2,
        cc,
        local,
        orderCount: localOrders.length,
        metrics: sumMetrics(localOrders.map((o) => o.metrics)),
        subRows: fechas,
      };
    });

    return {
      id: `empresa:${empresa}`,
      level: 1,
      empresa,
      orderCount: empresaOrders.length,
      metrics: sumMetrics(empresaOrders.map((o) => o.metrics)),
      subRows: locales,
    };
  });
}

function parseCLPNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") return 0;
  const negative = trimmed.startsWith("-");
  const digits = trimmed.replace(/[^0-9]/g, "");
  const value = digits === "" ? 0 : Number(digits);
  return negative ? -value : value;
}

interface RawOrderRow {
  empresa: string;
  cc: string;
  local: string;
  fecha: string;
  ordenId: string;
  /** Valores en el mismo orden que METRICS, tal como vienen del Excel. */
  values: string[];
}

// Dataset de ejemplo (nivel más granular) provisto para construir el mock.
const RAW_ORDERS: RawOrderRow[] = [
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "07-09-2026", ordenId: "118477032", values: ["10.490", "-", "-", "-1.678", "-", "-", "-", "-319", "-", "-", "-", "-", "-", "8.493"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "08-09-2026", ordenId: "118495050", values: ["5.500", "-", "-", "-1.040", "-", "840", "-", "-198", "160", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "08-09-2026", ordenId: "118499852", values: ["14.270", "-", "-", "-2.283", "-", "-", "-", "-434", "-", "-", "-", "-", "-", "11.553"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "09-09-2026", ordenId: "118509106", values: ["12.000", "-", "-", "-2.080", "-", "840", "-", "-395", "160", "-", "-", "-", "-", "10.525"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "09-09-2026", ordenId: "118510984", values: ["6.500", "-", "-", "-1.040", "-", "-", "-", "-198", "-", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "09-09-2026", ordenId: "118511629", values: ["3.571", "-", "-", "-1.070", "-", "2.621", "-", "-203", "498", "-", "-", "-", "-", "5.416"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "09-09-2026", ordenId: "118515648", values: ["14.990", "-", "-", "-2.398", "-", "-", "-", "-456", "-", "-", "-", "-", "-", "12.136"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "10-09-2026", ordenId: "118537101", values: ["5.500", "-", "-", "-1.040", "-", "840", "-", "-198", "160", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "10-09-2026", ordenId: "118548954", values: ["6.980", "-", "-", "-1.117", "-", "-", "-", "-212", "-", "-", "-", "-", "-", "5.651"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "11-09-2026", ordenId: "118560676", values: ["12.000", "-", "-", "-2.080", "-", "840", "-", "-395", "160", "-", "-", "-", "-", "10.525"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "11-09-2026", ordenId: "118565985", values: ["11.990", "-", "-", "-1.918", "-", "-", "-", "-364", "-", "-", "-", "-", "-", "9.707"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "11-09-2026", ordenId: "118566774", values: ["5.500", "-", "-", "-1.040", "-", "840", "-", "-198", "160", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "11-09-2026", ordenId: "118568258", values: ["14.990", "-", "-", "-2.398", "-", "-", "-", "-456", "-", "-", "-", "-", "-", "12.136"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "11-09-2026", ordenId: "118570506", values: ["5.500", "-", "-", "-1.040", "-", "840", "-", "-198", "160", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "11-09-2026", ordenId: "118578459", values: ["1.766", "-", "-", "-1.040", "-", "3.978", "-", "-198", "756", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "12-09-2026", ordenId: "118595262", values: ["5.500", "-", "-", "-1.040", "-", "840", "-", "-198", "160", "-", "-", "-", "-", "5.262"] },
  { empresa: "COMERCIAL TARRAGONA S.A.", cc: "L052", local: "12 Oriente Talca", fecha: "13-09-2026", ordenId: "118628915", values: ["5.500", "-", "-", "-1.040", "-", "840", "-", "-198", "160", "-", "-", "-", "-", "5.262"] },
];

export const mockOrders: OrderLeaf[] = RAW_ORDERS.map((row) => {
  const metrics = emptyMetrics();
  METRICS.forEach((def, i) => {
    metrics[def.key] = parseCLPNumber(row.values[i]);
  });
  return { empresa: row.empresa, cc: row.cc, local: row.local, fecha: row.fecha, ordenId: row.ordenId, metrics };
});
