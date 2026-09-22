import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import DashboardHero from "@/components/DashboardHero";
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

      <div className="flex justify-end">
        <Link href="/dashboard" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          ← Resumen ejecutivo
        </Link>
      </div>

      <Explorer companies={companies ?? []} stores={stores ?? []} />
    </div>
  );
}
