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
  headingLevel = "h2",
}: {
  id: string;
  title: string;
  description: ReactNode;
  dataDate: string;
  table: ReactNode;
  children: ReactNode;
  /** h3 when the card sits inside a page section that has its own h2. */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(11,11,11,0.04)] sm:p-8 lg:p-10"
    >
      <Heading id={`${id}-title`} className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem] sm:leading-tight">
        <a href={`#${id}`} className="text-ink hover:no-underline">
          {title}
        </a>
      </Heading>
      <p className="mt-3 max-w-3xl text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">{description}</p>
      <div className="mt-8 sm:mt-10">{children}</div>
      <DataExtras dataDate={dataDate} table={table} />
    </section>
  );
}

/** The data table behind a chart (TRD-10) and the credit line (TRD-04); also for charts outside a ChartCard. */
export function DataExtras({ dataDate, table, className = "" }: { dataDate: string; table: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <details className="mt-8 text-base">
        <summary className="cursor-pointer font-medium text-ink-2 select-none hover:text-ink">Show the data table</summary>
        <div className="mt-4 overflow-x-auto">{table}</div>
      </details>
      <Credit dataDate={dataDate} className="mt-6 border-t border-line pt-4" />
    </div>
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
    <table className="w-full min-w-[30rem] border-collapse text-left text-base">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-ink-2">
          {columns.map((c, i) => (
            <th key={c} scope="col" className={`py-3 pr-5 font-medium ${i > 0 ? "text-right" : ""}`}>
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
                <th key={i} scope="row" className="py-3 pr-5 font-normal text-ink">
                  {cell}
                </th>
              ) : (
                <td key={i} className="py-3 pr-5 text-right tabular-nums text-ink">
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
