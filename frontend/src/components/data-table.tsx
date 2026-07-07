"use client";

import clsx from "clsx";

interface DataTableProps<T extends object> {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: T[];
  emptyMessage: string;
  maxHeight?: string;
}

export function DataTable<T extends object>({
  title,
  subtitle,
  columns,
  rows,
  emptyMessage,
  maxHeight = "28rem",
}: DataTableProps<T>) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-black/10 backdrop-blur">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-300">{subtitle}</p> : null}
      </div>

      {rows.length ? (
        <div className="overflow-auto" style={{ maxHeight }}>
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className={clsx(
                      "border-b border-white/10 px-4 py-3 font-medium whitespace-nowrap text-slate-100",
                      "first:rounded-tl-2xl last:rounded-tr-2xl",
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="odd:bg-white/[0.03]">
                  {columns.map((column) => (
                    <td
                      key={`${title}-${rowIndex}-${column}`}
                      className="max-w-[280px] border-b border-white/5 px-4 py-3 align-top text-slate-200"
                    >
                      <div className="max-h-16 overflow-hidden whitespace-pre-wrap break-words">
                        {String((row as Record<string, unknown>)[column] ?? "") || "—"}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-10 text-sm text-slate-300">{emptyMessage}</div>
      )}
    </section>
  );
}
