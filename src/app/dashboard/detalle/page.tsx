import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DashboardHero from "@/components/DashboardHero";
import LogoutButton from "@/components/LogoutButton";
import Explorer from "./Explorer";

export const dynamic = "force-dynamic";

export default async function DetallePage() {
  const [{ data: companies }, { data: stores }] = await Promise.all([
    supabaseAdmin.from("companies").select("id, name").order("name"),
    supabaseAdmin
      .from("stores")
      .select("id, name, local_name, company_id")
      .order("name"),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-10 font-sans">
      <DashboardHero
        eyebrow="Agregadores de delivery"
        title="Detalle"
        accent="por local"
        subtitle="Filtra por empresa y local para ver las ventas día a día. Haz clic en un día para ver el detalle de sus pedidos."
        badges={[`${companies?.length ?? 0} empresas`, `${stores?.length ?? 0} locales`]}
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

      <Explorer companies={companies ?? []} stores={stores ?? []} />
    </div>
  );
}
