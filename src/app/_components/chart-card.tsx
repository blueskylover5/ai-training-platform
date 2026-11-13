import type { ReactNode } from "react";
import { Credit } from "./credit";

/**
 * A chart with what it counts and its sample size (TRD-06), a data table (TRD-10)
 * and the credit line (TRD-04).
 */
export function ChartCard({
  id,
  title,
  description,
  dataDate,
  table,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  dataDate: string;
  table: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-ink">
        <a href={`#${id}`} className="text-ink hover:no-underline">
          {title}
        </a>
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-2">{description}</p>
      <div className="mt-6">{children}</div>
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-ink-2 select-none hover:text-ink">Show the data table</summary>
        <div className="mt-3 overflow-x-auto">{table}</div>
      </details>
      <Credit dataDate={dataDate} className="mt-4 border-t border-line pt-3" />
    </section>
  );
}

/** A plain data table: first column is the name, the rest are right-aligned numbers. */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: Array<{ key: string; cells: ReactNode[] }>;
}) {
  return (
    <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-ink-2">
          {columns.map((c, i) => (
            <th key={c} scope="col" className={`py-2 pr-4 font-medium ${i > 0 ? "text-right" : ""}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-0">
            {row.cells.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row" className="py-2 pr-4 font-normal text-ink">
                  {cell}
                </th>
              ) : (
                <td key={i} className="py-2 pr-4 text-right tabular-nums text-ink">
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
