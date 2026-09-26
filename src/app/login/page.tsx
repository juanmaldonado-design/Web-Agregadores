"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardHero from "@/components/DashboardHero";
import { Button3D } from "@/components/Button3D";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("password", password);
    try {
      const res = await fetch("/api/login", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "No se pudo iniciar sesión.");
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12 font-sans">
      <DashboardHero eyebrow="Acceso" title="Web Agregadores" subtitle="Ingresa la clave para ver el dashboard." />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="password"
          autoFocus
          required
          placeholder="Clave de acceso"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-zinc-300 p-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button3D type="submit" disabled={loading} fullWidth className="disabled:opacity-50">
          {loading ? "Entrando..." : "Entrar"}
        </Button3D>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
