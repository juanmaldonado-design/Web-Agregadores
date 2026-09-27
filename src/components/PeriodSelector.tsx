"use client";

import { useRouter } from "next/navigation";
import Dropdown from "./Dropdown";

export default function PeriodSelector({
  periods,
  selectedKey,
  basePath = "/dashboard",
}: {
  periods: { period_start: string; period_end: string }[];
  selectedKey: string;
  basePath?: string;
}) {
  const router = useRouter();

  const options = periods.map((p) => ({
    value: `${p.period_start}_${p.period_end}`,
    label: `${p.period_start} → ${p.period_end}`,
  }));

  return (
    <Dropdown
      value={selectedKey}
      options={options}
      onChange={(v) => router.push(`${basePath}?period=${v}`)}
      className="min-w-[220px]"
    />
  );
}
