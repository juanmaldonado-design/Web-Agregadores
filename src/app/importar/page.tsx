"use client";

import { useState } from "react";

type FileStatus = "pending" | "loading" | "success" | "error";

interface FileResult {
  name: string;
  status: FileStatus;
  message?: string;
}

interface ImportRow {
  id: string;
  file_name: string;
  period_start: string;
  period_end: string;
  imported_at: string;
  platforms: { name: string } | null;
}

export default function ImportarPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [secret, setSecret] = useState("");
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<FileResult[]>([]);
  const [imports, setImports] = useState<ImportRow[] | null>(null);
  const [importsError, setImportsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadImports() {
    setImportsError(null);
    try {
      const res = await fetch("/api/import/list", {
        headers: { "x-import-secret": secret },
      });
      const data = await res.json();
      if (!res.ok) {
        setImportsError(data.error ?? "No se pudo cargar el listado.");
        return;
      }
      setImports(data.imports);
    } catch {
      setImportsError("No se pudo conectar con el servidor.");
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`¿Borrar "${label}"? Se eliminan también todos sus pedidos y resúmenes. No se puede deshacer.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/import/${id}`, {
        method: "DELETE",
        headers: { "x-import-secret": secret },
      });
      const data = await res.json();
      if (!res.ok) {
        setImportsError(data.error ?? "No se pudo borrar.");
        return;
      }
      await loadImports();
    } catch {
      setImportsError("No se pudo conectar con el servidor.");
    } finally {
      setDeletingId(null);
    }
  }

  async function uploadOne(file: File): Promise<FileResult> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("secret", secret);

    try {
      const res = await fetch("/api/import/rappi", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        const diag = data.supabaseUrlEnv ? ` (Supabase URL configurada: ${data.supabaseUrlEnv})` : "";
        return { name: file.name, status: "error", message: (data.error ?? "Error al subir el archivo.") + diag };
      }

      const { weekLabel, periodStart, periodEnd, ordersImported, summaryRowsImported, warnings } = data.result;
      const weekPrefix = weekLabel ? `${weekLabel} (${periodStart} → ${periodEnd})` : `Semana ${periodStart} → ${periodEnd}`;
      let message = `${weekPrefix}: ${ordersImported} pedidos y ${summaryRowsImported} filas de resumen.`;
      if (warnings?.length) {
        message += ` Avisos: ${warnings.join("; ")}`;
      }
      return { name: file.name, status: "success", message };
    } catch {
      return { name: file.name, status: "error", message: "No se pudo conectar con el servidor." };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setResults(files.map((f) => ({ name: f.name, status: "pending" })));

    // Se suben de a uno (no en paralelo) para no saturar la base de datos
    // y para poder mostrar el progreso archivo por archivo.
    for (let i = 0; i < files.length; i++) {
      setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "loading" } : r)));
      const result = await uploadOne(files[i]);
      setResults((prev) => prev.map((r, idx) => (idx === i ? result : r)));
    }

    setUploading(false);
    setFiles([]);
    loadImports();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16 font-sans">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Subir Excel de Rappi</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sube uno o varios archivos semanales (los que traen las hojas &quot;Consolidado
            Semanal&quot; y &quot;Resumen Cuadratura&quot;). Subir el mismo archivo de nuevo
            reemplaza los datos de esa semana, no los duplica.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Archivos Excel (.xlsx) — puedes seleccionar varios
            <input
              type="file"
              accept=".xlsx"
              multiple
              required
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="rounded border border-zinc-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-sm file:text-white dark:border-zinc-700 dark:file:bg-zinc-50 dark:file:text-black"
            />
          </label>

          {files.length > 0 && (
            <ul className="text-sm text-zinc-600 dark:text-zinc-400">
              {files.map((f) => (
                <li key={f.name}>• {f.name}</li>
              ))}
            </ul>
          )}

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
            disabled={uploading || files.length === 0}
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
          >
            {uploading ? "Subiendo..." : files.length > 1 ? `Subir ${files.length} archivos` : "Subir"}
          </button>
        </form>

        {results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((r) => (
              <li
                key={r.name}
                className={`whitespace-pre-wrap rounded border p-3 text-sm ${
                  r.status === "success"
                    ? "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
                    : r.status === "error"
                      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
                      : "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                }`}
              >
                <p className="font-medium">
                  {r.status === "pending" && "⏳ "}
                  {r.status === "loading" && "⏳ Subiendo… "}
                  {r.status === "success" && "✅ "}
                  {r.status === "error" && "❌ "}
                  {r.name}
                </p>
                {r.message && <p className="mt-1">{r.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Cargas anteriores</h2>
          <button
            type="button"
            onClick={loadImports}
            disabled={!secret}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
          >
            {imports ? "Actualizar" : "Ver cargas"}
          </button>
        </div>

        {!secret && <p className="text-sm text-zinc-500">Escribe la clave de acceso arriba para ver el listado.</p>}
        {importsError && <p className="text-sm text-red-600 dark:text-red-400">{importsError}</p>}

        {imports && imports.length === 0 && (
          <p className="text-sm text-zinc-500">Todavía no hay ninguna carga.</p>
        )}

        {imports && imports.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <th className="py-2 pr-2 font-medium">Plataforma</th>
                <th className="py-2 pr-2 font-medium">Archivo</th>
                <th className="py-2 pr-2 font-medium">Semana</th>
                <th className="py-2 pr-2 font-medium">Subido</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {imports.map((imp) => (
                <tr key={imp.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2 pr-2">{imp.platforms?.name ?? "-"}</td>
                  <td className="max-w-[180px] truncate py-2 pr-2" title={imp.file_name}>
                    {imp.file_name}
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap">
                    {imp.period_start} → {imp.period_end}
                  </td>
                  <td className="py-2 pr-2 whitespace-nowrap text-zinc-500">
                    {new Date(imp.imported_at).toLocaleString("es-CL")}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(imp.id, `${imp.platforms?.name ?? ""} ${imp.period_start} → ${imp.period_end}`)}
                      disabled={deletingId === imp.id}
                      className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    >
                      {deletingId === imp.id ? "Borrando..." : "Borrar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
