"use client";

import { useRef, useState } from "react";

export default function FileDropzone({
  files,
  onFilesChange,
  accept = ".xlsx",
  multiple = true,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    onFilesChange(multiple ? [...files, ...Array.from(list)] : Array.from(list).slice(0, 1));
  }

  function removeFile(name: string) {
    onFilesChange(files.filter((f) => f.name !== name));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`card-elevated card-elevated-hover flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-[var(--tarragona-red)] bg-[var(--tarragona-red)]/5"
            : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
        }`}
      >
        <svg
          className={`h-9 w-9 transition-colors ${dragOver ? "text-[var(--tarragona-red)]" : "text-zinc-400"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 8.25L12 3.75m0 0L7.5 8.25M12 3.75v12.75"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Arrastra tus archivos aquí o <span className="text-[var(--tarragona-red)] underline">elige desde tu equipo</span>
        </p>
        <p className="text-xs text-zinc-400">Excel (.xlsx) — puedes seleccionar varios a la vez</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((f) => (
            <li
              key={f.name}
              className="row-hover flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="truncate text-zinc-700 dark:text-zinc-300">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(f.name)}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-[var(--tarragona-red)] dark:hover:bg-zinc-900"
                aria-label={`Quitar ${f.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
