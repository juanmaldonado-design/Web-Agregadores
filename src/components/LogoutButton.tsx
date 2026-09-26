"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-zinc-600 underline dark:text-zinc-400"
    >
      Cerrar sesión
    </button>
  );
}
