import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DashboardHero from "@/components/DashboardHero";
import LogoutButton from "@/components/LogoutButton";
import PeriodSelector from "@/components/PeriodSelector";
import DrilldownGrid from "@/components/DrilldownGrid";
import { buildHierarchy, extractMetrics, parseRawDateToISO, type OrderLeaf } from "@/lib/drilldown";

export const dynamic = "force-dynamic";

interface OrderQueryRow {
  external_order_id: string;
  order_created_at: string | null;
  platform_fee: number | string | null;
  platform_fee_tax: number | string | null;
  manual_adjustment: number | string | null;
  net_amount: number | string | null;
  raw: Record<string, unknown> | null;
  companies: { name: string } | null;
  stores: { local_name: string | null; cost_center: string | null } | null;
}

export default async function DrilldownPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;

  const { data: platform } = await supabaseAdmin.from("platforms").select("id").eq("slug", "rappi").single();

  if (!platform) {
    return <EmptyState reason="No se encontró la plataforma Rappi en la base de datos." />;
  }

  const { data: importRows } = await supabaseAdmin
    .from("imports")
    .select("period_start, period_end")
    .eq("platform_id", platform.id)
    .order("period_start", { ascending: false });

  const periods = Array.from(
    new Map((importRows ?? []).map((p) => [`${p.period_start}_${p.period_end}`, p])).values()
  );

  if (periods.length === 0) {
    return <EmptyState reason="Todavía no se ha subido ningún Excel. Sube uno en /importar." />;
  }

  const selected = periods.find((p) => `${p.period_start}_${p.period_end}` === periodParam) ?? periods[0];

  const { data: importRow } = await supabaseAdmin
    .from("imports")
    .select("id")
    .eq("platform_id", platform.id)
    .eq("period_start", selected.period_start)
    .eq("period_end", selected.period_end)
    .single();

  let data: ReturnType<typeof buildHierarchy> = [];

  if (importRow) {
    // Supabase limita cada consulta a ~1000 filas (max-rows de PostgREST) y
    // algunas semanas superan eso, así que se pagina hasta agotar los datos.
    const PAGE_SIZE = 1000;
    const rows: OrderQueryRow[] = [];
    for (let page = 0; ; page++) {
      const { data: pageRows, error } = await supabaseAdmin
        .from("orders")
        .select(
          "external_order_id, order_created_at, platform_fee, platform_fee_tax, manual_adjustment, net_amount, raw, companies(name), stores(local_name, cost_center)"
        )
        .eq("import_id", importRow.id)
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw error;
      const batch = (pageRows ?? []) as unknown as OrderQueryRow[];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    const leaves: OrderLeaf[] = rows.map((row) => {
      const fecha =
        parseRawDateToISO(row.raw?.["Fecha_Original_Rappi"]) ??
        (row.order_created_at ? row.order_created_at.slice(0, 10) : "sin-fecha");

      return {
        empresa: row.companies?.name ?? "(Sin empresa asignada)",
        cc: row.stores?.cost_center ?? "-",
        local: row.stores?.local_name ?? "(Sin local asignado)",
        fecha,
        ordenId: row.external_order_id,
        metrics: extractMetrics(row),
      };
    });

    data = buildHierarchy(leaves);
  }

  const companyCount = data.length;
  const totalOrders = data.reduce((acc, empresa) => acc + empresa.orderCount, 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10 font-sans">
      <DashboardHero
        eyebrow="Agregadores de delivery"
        title="Desglose"
        accent="jerárquico"
        subtitle={`Empresa → Cc / Local → Fecha → Orden, semana ${selected.period_start} → ${selected.period_end}.`}
        badges={[`${companyCount} empresas`, `${totalOrders} pedidos`]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSelector
          periods={periods}
          selectedKey={`${selected.period_start}_${selected.period_end}`}
          basePath="/dashboard/drilldown"
        />
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-[var(--tarragona-red)] dark:text-zinc-400 dark:hover:bg-zinc-900"
          >
            ← Resumen ejecutivo
          </Link>
          <LogoutButton />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Esta semana no tiene pedidos importados.
        </div>
      ) : (
        <DrilldownGrid data={data} />
      )}
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
