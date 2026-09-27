"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ExpandedState,
  type Row,
  type VisibilityState,
} from "@tanstack/react-table";
import { Button3D } from "@/components/Button3D";
import { DEFAULT_VISIBLE_METRICS, METRICS, formatFechaLong, type EmpresaRow, type HierarchyRow } from "@/lib/drilldown";

const currency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const columnHelper = createColumnHelper<HierarchyRow>();

const columns = [
  columnHelper.display({
    id: "jerarquia",
    header: "Empresa / Cc · Local / Fecha / Orden",
    cell: ({ row }) => <RowLabelCell row={row} />,
  }),
  ...METRICS.map((metric) =>
    columnHelper.accessor((row) => row.metrics[metric.key], {
      id: metric.key,
      header: () => <span title={metric.label}>{metric.short}</span>,
      cell: (info) => <MoneyCell value={info.getValue()} strong={metric.key === "valorNeto"} />,
    })
  ),
];

function MoneyCell({ value, strong }: { value: number; strong?: boolean }) {
  if (value === 0) {
    return <span className="tabular-nums text-zinc-300 dark:text-zinc-700">–</span>;
  }
  return (
    <span
      className={`tabular-nums whitespace-nowrap ${strong ? "font-semibold" : ""} ${
        value < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200"
      }`}
    >
      {currency.format(value)}
    </span>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const LABEL_TEXT_CLASS: Record<HierarchyRow["level"], string> = {
  1: "font-semibold text-black dark:text-zinc-50",
  2: "font-medium text-zinc-800 dark:text-zinc-200",
  3: "text-zinc-700 dark:text-zinc-300",
  4: "text-zinc-500 dark:text-zinc-400",
};

function RowLabelCell({ row }: { row: Row<HierarchyRow> }) {
  const original = row.original;
  const canExpand = row.getCanExpand();

  let label: string;
  let meta: string | null = null;
  switch (original.level) {
    case 1:
      label = original.empresa;
      meta = `${original.orderCount} pedidos`;
      break;
    case 2:
      label = `${original.cc} · ${original.local}`;
      meta = `${original.orderCount} pedidos`;
      break;
    case 3:
      label = formatFechaLong(original.fecha);
      meta = `${original.orderCount} pedidos`;
      break;
    case 4:
      label = `Orden #${original.ordenId}`;
      break;
  }

  return (
    <div className="flex w-full items-center gap-1.5" style={{ paddingLeft: row.depth * 20 }}>
      {canExpand ? (
        <button
          type="button"
          onClick={row.getToggleExpandedHandler()}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-[var(--tarragona-red)] dark:hover:bg-zinc-800"
          aria-label={row.getIsExpanded() ? "Contraer" : "Expandir"}
        >
          <ChevronIcon open={row.getIsExpanded()} />
        </button>
      ) : (
        <span className="h-5 w-5 shrink-0" />
      )}
      <span className={`truncate ${LABEL_TEXT_CLASS[original.level]}`}>{label}</span>
      {meta && <span className="ml-auto shrink-0 pl-2 text-xs whitespace-nowrap text-zinc-400">{meta}</span>}
    </div>
  );
}

function rowBaseBg(level: HierarchyRow["level"]) {
  return level === 1 ? "bg-zinc-50 dark:bg-zinc-900" : "bg-white dark:bg-zinc-950";
}

function GridRow({ row }: { row: Row<HierarchyRow> }) {
  const cells = row.getVisibleCells();
  const bg = rowBaseBg(row.original.level);

  return (
    <tr className="group">
      {cells.map((cell, i) => (
        <td
          key={cell.id}
          className={`${bg} relative border-b border-zinc-100 px-3 py-2 transition-colors group-hover:bg-[var(--tarragona-red)]/5 dark:border-zinc-900 ${
            i === 0
              ? "sticky left-0 z-10 border-r border-zinc-200 dark:border-zinc-800"
              : "border-l border-zinc-100 text-right dark:border-zinc-900"
          }`}
        >
          {i === 0 && (
            <span className="absolute top-0 bottom-0 left-0 w-[3px] scale-y-0 bg-[var(--tarragona-red)] transition-transform duration-150 group-hover:scale-y-100" />
          )}
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}

export default function DrilldownGrid({ data }: { data: EmpresaRow[] }) {
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [compact, setCompact] = useState(true);

  const columnVisibility = useMemo<VisibilityState>(() => {
    if (!compact) return {};
    const visibility: VisibilityState = {};
    for (const metric of METRICS) {
      if (!DEFAULT_VISIBLE_METRICS.includes(metric.key)) visibility[metric.key] = false;
    }
    return visibility;
  }, [compact]);

  const table = useReactTable({
    data,
    columns,
    state: { expanded, columnVisibility },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const headers = table.getHeaderGroups()[0]?.headers ?? [];

  const totalOrders = useMemo(() => data.reduce((acc, empresa) => acc + empresa.orderCount, 0), [data]);
  const totalLocales = useMemo(() => data.reduce((acc, empresa) => acc + empresa.subRows.length, 0), [data]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {data.length} {data.length === 1 ? "empresa" : "empresas"} · {totalLocales} {totalLocales === 1 ? "local" : "locales"} ·{" "}
          {totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button3D type="button" variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setCompact((c) => !c)}>
            {compact ? "Ver todas las columnas" : "Vista compacta"}
          </Button3D>
          <Button3D
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => table.toggleAllRowsExpanded(true)}
          >
            Expandir todo
          </Button3D>
          <Button3D
            type="button"
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => table.toggleAllRowsExpanded(false)}
          >
            Contraer todo
          </Button3D>
        </div>
      </div>

      <div className="card-elevated overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {headers.map((header, i) => (
                  <th
                    key={header.id}
                    className={`whitespace-nowrap border-b border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 ${
                      i === 0
                        ? "sticky top-0 left-0 z-30 min-w-[280px] border-r text-left dark:border-zinc-800"
                        : "sticky top-0 z-20 min-w-[132px] border-l border-zinc-100 text-right dark:border-zinc-900"
                    }`}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <GridRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
