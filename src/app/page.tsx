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
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Entorno en configuración inicial. El dashboard se construirá una
          vez definida la importación de datos desde Supabase.
        </p>
      </main>
    </div>
  );
}
