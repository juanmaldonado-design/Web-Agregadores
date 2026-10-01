"use client";

import { useRouter } from "next/navigation";
import Dropdown from "./Dropdown";

export default function PlatformSelector({
  platforms,
  selectedSlug,
  basePath,
  extraParams = {},
}: {
  platforms: { slug: string; name: string }[];
  selectedSlug: string;
  basePath: string;
  /** Otros parámetros de la URL a conservar al cambiar de plataforma (ej. from/to). */
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  const options = platforms.map((p) => ({ value: p.slug, label: p.name }));

  return (
    <Dropdown
      value={selectedSlug}
      options={options}
      onChange={(v) => {
        const params = new URLSearchParams({ ...extraParams, platform: v });
        router.push(`${basePath}?${params.toString()}`);
      }}
      className="min-w-[160px]"
    />
  );
}
