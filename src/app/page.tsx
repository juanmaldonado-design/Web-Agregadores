import DashboardHero from "@/components/DashboardHero";
import { LinkButton3D } from "@/components/Button3D";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12 font-sans">
      <DashboardHero
        eyebrow="Panel interno"
        title="Web Agregadores"
        subtitle="Resumen ejecutivo de ventas, comisiones y pagos de los agregadores de delivery (Rappi, Pedidos Ya, Justo, Uber Eats)."
        badges={["Rappi conectado", "Multi-empresa"]}
      />
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        <LinkButton3D href="/dashboard">Ver dashboard</LinkButton3D>
        <LinkButton3D href="/importar" variant="secondary">
          Subir Excel de Rappi
        </LinkButton3D>
      </div>
    </div>
  );
}
