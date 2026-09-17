"use client";

import { useState } from "react";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus({ kind: "loading" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("secret", secret);

    try {
      const res = await fetch("/api/import/rappi", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "Error al subir el archivo." });
        return;
      }

      const { weekLabel, periodStart, periodEnd, ordersImported, summaryRowsImported, warnings } = data.result;
      const weekPrefix = weekLabel ? `${weekLabel} (${periodStart} → ${periodEnd})` : `Semana ${periodStart} → ${periodEnd}`;
      let message = `${weekPrefix}: ${ordersImported} pedidos y ${summaryRowsImported} filas de resumen cargadas correctamente.`;
      if (warnings?.length) {
        message += `\n\nAvisos:\n${warnings.map((w: string) => `- ${w}`).join("\n")}`;
      }
      setStatus({ kind: "success", message });
      setFile(null);
    } catch {
      setStatus({ kind: "error", message: "No se pudo conectar con el servidor. Intenta de nuevo." });
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-16 font-sans">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Subir Excel de Rappi</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sube el archivo semanal (el que trae las hojas &quot;Consolidado Semanal&quot; y
          &quot;Resumen Cuadratura&quot;). Se puede subir el mismo archivo más de una vez sin
          duplicar datos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Archivo Excel (.xlsx)
          <input
            type="file"
            accept=".xlsx"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded border border-zinc-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-sm file:text-white dark:border-zinc-700 dark:file:bg-zinc-50 dark:file:text-black"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Clave de acceso
          <input
            type="password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="rounded border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <button
          type="submit"
          disabled={status.kind === "loading" || !file}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {status.kind === "loading" ? "Subiendo..." : "Subir"}
        </button>
      </form>

      {status.kind === "success" && (
        <pre className="whitespace-pre-wrap rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          {status.message}
        </pre>
      )}
      {status.kind === "error" && (
        <pre className="whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {status.message}
        </pre>
      )}
    </div>
  );
}
