"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button3D } from "./Button3D";

const dateInputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm transition-colors hover:border-[var(--tarragona-red)] focus:border-[var(--tarragona-red)] focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:[color-scheme:dark]";

export default function DateRangeSelector({
  from,
  to,
  basePath,
}: {
  from: string;
  to: string;
  basePath: string;
}) {
  const router = useRouter();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  function apply() {
    router.push(`${basePath}?from=${draftFrom}&to=${draftTo}`);
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Desde
        <input
          type="date"
          value={draftFrom}
          max={draftTo}
          onChange={(e) => setDraftFrom(e.target.value)}
          className={dateInputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Hasta
        <input
          type="date"
          value={draftTo}
          min={draftFrom}
          onChange={(e) => setDraftTo(e.target.value)}
          className={dateInputClass}
        />
      </label>
      <Button3D type="submit" className="!px-4 !py-2 text-sm">
        Ver
      </Button3D>
    </form>
  );
}
