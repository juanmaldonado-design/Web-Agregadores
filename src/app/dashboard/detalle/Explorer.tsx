"use client";

import { useEffect, useMemo, useState } from "react";

interface Company {
  id: number;
  name: string;
}

interface Store {
  id: string;
  name: string;
  local_name: string | null;
  company_id: number | null;
}

interface DayBucket {
  date: string;
  orderCount: number;
  grossSales: number;
  platformFee: number;
  netAmount: number;
}

interface OrderRow {
  id: string;
  external_order_id: string;
  order_created_at: string;
  transaction_type: string | null;
  order_status: string | null;
  gross_sales: number;
  platform_fee: number;
  platform_fee_tax: number;
  manual_adjustment: number;
  net_amount: number;
  raw: Record<string, unknown> | null;
}

const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const dayLabel = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
const fullDayLabel = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export default function Explorer({ companies, stores }: { companies: Company[]; stores: Store[] }) {
  const [companyId, setCompanyId] = useState<number | "all">("all");
  const [storeId, setStoreId] = useState<string>("");
  const [days, setDays] = useState<DayBucket[] | null>(null);
  const [loadingDays, setLoadingDays] = useState(false);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [grown, setGrown] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const filteredStores = useMemo(
    () => stores.filter((s) => companyId === "all" || s.company_id === companyId),
    [stores, companyId]
  );

  const selectedStore = useMemo(() => stores.find((s) => s.id === storeId) ?? null, [stores, storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    // Marca "cargando" antes del fetch: es el estado de la petición en curso,
    // no algo derivable de props/estado existente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingDays(true);
    setDaysError(null);
    setGrown(false);
    fetch(`/api/dashboard/daily-sales?storeId=${storeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setDaysError(data.error);
          setDays(null);
        } else {
          setDays(data.days);
        }
      })
      .catch(() => {
        if (!cancelled) setDaysError("No se pudo conectar con el servidor.");
      })
      .finally(() => {
        if (!cancelled) setLoadingDays(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (days && days.length > 0) {
      const t = setTimeout(() => setGrown(true), 30);
      return () => clearTimeout(t);
    }
  }, [days]);

  function openDay(date: string) {
    setSelectedDate(date);
    setOrders(null);
    setOrdersError(null);
    setLoadingOrders(true);
    fetch(`/api/dashboard/orders?storeId=${storeId}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setOrdersError(data.error);
        } else {
          setOrders(data.orders);
        }
      })
      .catch(() => setOrdersError("No se pudo conectar con el servidor."))
      .finally(() => setLoadingOrders(false));
  }

  const maxGross = days ? Math.max(...days.map((d) => d.grossSales), 1) : 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Empresa</span>
          <select
            value={companyId}
            onChange={(e) => {
              const v = e.target.value;
              setCompanyId(v === "all" ? "all" : Number(v));
              setStoreId("");
            }}
            className="min-w-[200px] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm transition-colors focus:border-[#2a78d6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="all">Todas las empresas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Local</span>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="min-w-[240px] rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm transition-colors focus:border-[#2a78d6] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">Selecciona un local…</option>
            {filteredStores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.local_name || s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Estado vacío */}
      {!storeId && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Elige una empresa y un local para ver sus ventas día a día.
        </div>
      )}

      {storeId && loadingDays && (
        <div className="flex h-64 items-end gap-1.5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 animate-pulse rounded-t bg-zinc-200 dark:bg-zinc-800"
              style={{ height: `${20 + ((i * 37) % 60)}%` }}
            />
          ))}
        </div>
      )}

      {storeId && daysError && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {daysError}
        </p>
      )}

      {storeId && !loadingDays && days && days.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {selectedStore?.local_name || selectedStore?.name}: todavía no tiene pedidos con fecha registrada.
        </div>
      )}

      {storeId && !loadingDays && days && days.length > 0 && (
        <div className="animate-fade-in-up flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-black dark:text-zinc-50">
              {selectedStore?.local_name || selectedStore?.name}
            </h2>
            <p className="text-sm text-zinc-500">
              {days.length} días con ventas · {days.reduce((a, d) => a + d.orderCount, 0)} pedidos ·{" "}
              {currency.format(days.reduce((a, d) => a + d.grossSales, 0))} en ventas brutas
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="flex h-56 min-w-full items-end gap-1.5 pb-1" style={{ minWidth: `${days.length * 28}px` }}>
              {days.map((d) => {
                const heightPct = grown ? Math.max((d.grossSales / maxGross) * 100, 3) : 0;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => openDay(d.date)}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                    title={`${dayLabel.format(new Date(d.date))} — ${currency.format(d.grossSales)}`}
                  >
                    <div className="pointer-events-none absolute -top-9 hidden whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white group-hover:block dark:bg-zinc-100 dark:text-black">
                      {currency.format(d.grossSales)} · {d.orderCount} pedidos
                    </div>
                    <div
                      className="w-full rounded-t-[4px] bg-[#2a78d6] transition-[height] duration-500 ease-out group-hover:bg-[#1c5cab] dark:bg-[#3987e5] dark:group-hover:bg-[#5598e7]"
                      style={{ height: `${heightPct}%`, transitionDelay: `${Math.min(days.indexOf(d) * 12, 400)}ms` }}
                    />
                    <span className="mt-1.5 text-[10px] text-zinc-500 [writing-mode:vertical-rl]">
                      {dayLabel.format(new Date(d.date))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-zinc-400">Haz clic en un día para ver el detalle de sus pedidos.</p>
        </div>
      )}

      {/* Modal detalle del día */}
      {selectedDate && (
        <div
          className="animate-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="animate-scale-in flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl dark:bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
              <div>
                <h3 className="font-semibold text-black capitalize dark:text-zinc-50">
                  {fullDayLabel.format(new Date(selectedDate))}
                </h3>
                <p className="text-xs text-zinc-500">{selectedStore?.local_name || selectedStore?.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {loadingOrders && <p className="text-sm text-zinc-500">Cargando pedidos…</p>}
              {ordersError && <p className="text-sm text-red-600 dark:text-red-400">{ordersError}</p>}
              {orders && orders.length === 0 && <p className="text-sm text-zinc-500">Sin pedidos este día.</p>}
              {orders && orders.length > 0 && (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                      <th className="py-1.5 pr-2 font-medium">Hora</th>
                      <th className="py-1.5 pr-2 font-medium">ID Rappi</th>
                      <th className="py-1.5 pr-2 font-medium">Tipo</th>
                      <th className="py-1.5 pr-2 font-medium">Estado</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Venta bruta</th>
                      <th className="py-1.5 pr-2 text-right font-medium">Comisión</th>
                      <th className="py-1.5 text-right font-medium">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                        <td className="py-1.5 pr-2 tabular-nums">{formatTime(o.order_created_at)}</td>
                        <td className="py-1.5 pr-2 tabular-nums text-zinc-500">{o.external_order_id}</td>
                        <td className="py-1.5 pr-2">{o.transaction_type ?? "-"}</td>
                        <td className="py-1.5 pr-2 text-zinc-500">{o.order_status ?? "-"}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{currency.format(o.gross_sales)}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">
                          {currency.format(o.platform_fee + o.platform_fee_tax)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{currency.format(o.net_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                      <td className="py-1.5" colSpan={4}>
                        Total
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {currency.format(orders.reduce((a, o) => a + o.gross_sales, 0))}
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {currency.format(orders.reduce((a, o) => a + o.platform_fee + o.platform_fee_tax, 0))}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {currency.format(orders.reduce((a, o) => a + o.net_amount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
