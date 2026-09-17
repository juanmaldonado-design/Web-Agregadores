import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Web Agregadores
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Resumen ejecutivo de ventas, comisiones y pagos de los agregadores
          de delivery (Rappi, Pedidos Ya, Justo, Uber Eats).
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-block rounded bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
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
      </main>
    </div>
  );
}
