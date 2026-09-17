import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface WeeklySummaryRow {
  id: string;
  company_id: number;
  tipo_local: string | null;
  estado: string | null;
  monto_a_depositar: number;
  banco_recibido: number;
  monto_a_facturar_neto: number;
  facturado_xml_neto: number;
  dif_banco: number;
  dif_factura: number;
  fecha_pago: string | null;
  companies: { name: string } | null;
}

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

function StatusBadge({ estado }: { estado: string | null }) {
  const ok = estado?.includes("✅") || estado?.toLowerCase().includes("ok");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? "bg-[#0ca30c]/10 text-[#0ca30c] dark:bg-[#0ca30c]/15"
          : "bg-[#fab219]/15 text-[#8a5a00] dark:bg-[#fab219]/20 dark:text-[#fab219]"
      }`}
    >
      <span aria-hidden>{ok ? "✅" : "⚠️"}</span>
      {estado?.replace(/[✅⚠️]/g, "").trim() || (ok ? "OK" : "Revisar")}
    </span>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-black dark:text-zinc-50">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;

  const { data: platform } = await supabaseAdmin.from("platforms").select("id").eq("slug", "rappi").single();

  if (!platform) {
    return <EmptyState reason="No se encontró la plataforma Rappi en la base de datos." />;
  }

  const { data: periodRows } = await supabaseAdmin
    .from("weekly_summary")
    .select("period_start, period_end")
    .eq("platform_id", platform.id)
    .order("period_start", { ascending: false });

  const periods = Array.from(
    new Map((periodRows ?? []).map((p) => [`${p.period_start}_${p.period_end}`, p])).values()
  );

  if (periods.length === 0) {
    return <EmptyState reason="Todavía no se ha subido ningún Excel. Sube uno en /importar." />;
  }

  const selected =
    periods.find((p) => `${p.period_start}_${p.period_end}` === periodParam) ?? periods[0];

  const { data: summaryRows } = await supabaseAdmin
    .from("weekly_summary")
    .select(
      "id, company_id, tipo_local, estado, monto_a_depositar, banco_recibido, monto_a_facturar_neto, facturado_xml_neto, dif_banco, dif_factura, fecha_pago, companies(name)"
    )
    .eq("platform_id", platform.id)
    .eq("period_start", selected.period_start)
    .eq("period_end", selected.period_end)
    .order("company_id");

  const rows = (summaryRows ?? []) as unknown as WeeklySummaryRow[];

  const { data: importRow } = await supabaseAdmin
    .from("imports")
    .select("id")
    .eq("platform_id", platform.id)
    .eq("period_start", selected.period_start)
    .eq("period_end", selected.period_end)
    .single();

  let grossSales = 0;
  let platformFee = 0;
  if (importRow) {
    const { data: orderTotals } = await supabaseAdmin
      .from("orders")
      .select("gross_sales, platform_fee, platform_fee_tax")
      .eq("import_id", importRow.id);
    for (const o of orderTotals ?? []) {
      grossSales += Number(o.gross_sales) || 0;
      platformFee += (Number(o.platform_fee) || 0) + (Number(o.platform_fee_tax) || 0);
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      monto_a_depositar: acc.monto_a_depositar + Number(r.monto_a_depositar),
      banco_recibido: acc.banco_recibido + Number(r.banco_recibido),
      monto_a_facturar_neto: acc.monto_a_facturar_neto + Number(r.monto_a_facturar_neto),
      facturado_xml_neto: acc.facturado_xml_neto + Number(r.facturado_xml_neto),
      dif_banco: acc.dif_banco + Number(r.dif_banco),
      dif_factura: acc.dif_factura + Number(r.dif_factura),
    }),
    { monto_a_depositar: 0, banco_recibido: 0, monto_a_facturar_neto: 0, facturado_xml_neto: 0, dif_banco: 0, dif_factura: 0 }
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16 font-sans">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Resumen ejecutivo — Rappi</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Semana {selected.period_start} → {selected.period_end}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form className="flex items-center gap-2">
            <select
              name="period"
              defaultValue={`${selected.period_start}_${selected.period_end}`}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {periods.map((p) => {
                const key = `${p.period_start}_${p.period_end}`;
                return (
                  <option key={key} value={key}>
                    {p.period_start} → {p.period_end}
                  </option>
                );
              })}
            </select>
            <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
              Ver
            </button>
          </form>
          <Link href="/importar" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            Subir Excel
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Ventas brutas" value={currency.format(grossSales)} />
        <StatTile label="Comisión Rappi" value={currency.format(platformFee)} />
        <StatTile label="Neto a depositar" value={currency.format(totals.monto_a_depositar)} />
        <StatTile
          label="Diferencia banco"
          value={currency.format(totals.dif_banco)}
          hint={Math.abs(totals.dif_banco) < 1 ? "Cuadra" : "Revisar"}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-3 py-2 font-medium">Empresa</th>
              <th className="px-3 py-2 font-medium">Tipo local</th>
              <th className="px-3 py-2 text-right font-medium">A depositar</th>
              <th className="px-3 py-2 text-right font-medium">Banco recibido</th>
              <th className="px-3 py-2 text-right font-medium">Dif. banco</th>
              <th className="px-3 py-2 text-right font-medium">A facturar</th>
              <th className="px-3 py-2 text-right font-medium">Facturado XML</th>
              <th className="px-3 py-2 text-right font-medium">Dif. factura</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                <td className="px-3 py-2 font-medium text-black dark:text-zinc-50">{r.companies?.name ?? "-"}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.tipo_local ?? "-"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{currency.format(r.monto_a_depositar)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{currency.format(r.banco_recibido)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{currency.format(r.dif_banco)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{currency.format(r.monto_a_facturar_neto)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{currency.format(r.facturado_xml_neto)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{currency.format(r.dif_factura)}</td>
                <td className="px-3 py-2">
                  <StatusBadge estado={r.estado} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-300 font-semibold text-black dark:border-zinc-700 dark:text-zinc-50">
              <td className="px-3 py-2" colSpan={2}>
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{currency.format(totals.monto_a_depositar)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{currency.format(totals.banco_recibido)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{currency.format(totals.dif_banco)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{currency.format(totals.monto_a_facturar_neto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{currency.format(totals.facturado_xml_neto)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{currency.format(totals.dif_factura)}</td>
              <td className="px-3 py-2" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ reason }: { reason: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center font-sans">
      <p className="text-zinc-600 dark:text-zinc-400">{reason}</p>
      <Link href="/importar" className="rounded bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black">
        Ir a subir Excel
      </Link>
    </div>
  );
}
