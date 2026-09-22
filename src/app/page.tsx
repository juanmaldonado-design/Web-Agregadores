import Link from "next/link";
import DashboardHero from "@/components/DashboardHero";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12 font-sans">
      <DashboardHero
        eyebrow="Panel interno"
        title="Web Agregadores"
        subtitle="Resumen ejecutivo de ventas, comisiones y pagos de los agregadores de delivery (Rappi, Pedidos Ya, Justo, Uber Eats)."
        badges={["Rappi conectado", "Multi-empresa"]}
      />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-block rounded bg-[#eda100] px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#c98500]"
        >
          Ver dashboard
        </Link>
        <Link
          href="/importar"
          className="inline-block rounded border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Subir Excel de Rappi
        </Link>
      </div>
    </div>
  );
}
