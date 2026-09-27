import Link from "next/link";
import DashboardHero from "@/components/DashboardHero";
import LogoutButton from "@/components/LogoutButton";
import DrilldownGrid from "@/components/DrilldownGrid";
import { buildHierarchy, mockOrders } from "@/lib/drilldown";

export const dynamic = "force-dynamic";

export default function DrilldownPage() {
  const data = buildHierarchy(mockOrders);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10 font-sans">
      <DashboardHero
        eyebrow="Agregadores de delivery"
        title="Desglose"
        accent="jerárquico"
        subtitle="Empresa → Cc / Local → Fecha → Orden. Expande cada nivel para llegar al detalle transaccional."
        badges={["4 niveles de profundidad", "Datos de ejemplo"]}
      />

      <div className="flex justify-end gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-[var(--tarragona-red)] dark:text-zinc-400 dark:hover:bg-zinc-900"
        >
          ← Resumen ejecutivo
        </Link>
        <LogoutButton />
      </div>

      <DrilldownGrid data={data} />
    </div>
  );
}
