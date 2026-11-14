import type { ReactNode } from "react";
import { formatCount, formatMoney, formatShortDate, niceScale } from "@/trends/present";

/*
 * Server-rendered charts in plain HTML and CSS: no chart library and no client JavaScript.
 * Marks follow the house specs: bars at most 24px thick with a 4px rounded data end and a
 * square baseline, hairline grid, text in ink colours (never the series colour), and a
 * hover tooltip on each mark. Every chart ships with a data table in its ChartCard.
 */

/** Hover tooltip shown above its parent `group` element. */
function Tip({ children, align = "center" }: { children: ReactNode; align?: "center" | "end" }) {
  const position = align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max max-w-[min(28rem,calc(100vw-2.5rem))] rounded-lg bg-ink px-3 py-2 text-sm leading-5 text-page shadow-lg group-hover:block ${position}`}
    >
      {children}
    </span>
  );
}

const percent = (value: number, max: number) => `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

export interface BarItem {
  key: string;
  label: string;
  value: number;
}

/** Ranked horizontal bars with the value at each bar's tip. */
export function BarList({
  items,
  total,
  unit,
  formatValue = formatCount,
  tip,
}: {
  items: BarItem[];
  total: number;
  unit: string;
  /** How the value at each bar's tip reads; a count by default. */
  formatValue?: (value: number) => string;
  /** Tooltip text; by default the value and its share of `total`. */
  tip?: (item: BarItem) => ReactNode;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul role="list" className="flex flex-col gap-4 sm:gap-2">
      {items.map((item) => (
        <li
          key={item.key}
          className="group relative grid grid-cols-1 items-center gap-x-5 gap-y-1.5 rounded-lg sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:px-3 sm:py-1.5 sm:hover:bg-tint"
        >
          <span className="text-base text-ink sm:truncate" title={item.label}>
            {item.label}
          </span>
          <span className="relative flex items-center gap-3">
            <span
              className="h-5 min-w-0.5 rounded-r-[4px] bg-series"
              style={{ width: `calc((100% - 4rem) * ${item.value / max})` }}
            />
            <span className="text-base font-medium tabular-nums text-ink">{formatValue(item.value)}</span>
            <Tip align="end">
              {tip
                ? tip(item)
                : `${item.label}: ${formatCount(item.value)} ${unit} (${Math.round((item.value / total) * 100)}% of ${formatCount(total)})`}
            </Tip>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Column chart of new roles per week, oldest week on the left; the latest column is labelled. */
export function WeeklyColumns({ weeks }: { weeks: Array<{ weekStart: string; newRoles: number }> }) {
  const scale = niceScale(Math.max(...weeks.map((w) => w.newRoles)), 3);
  const last = weeks.length - 1;
  // Below desktop width, label every third week counting back from the latest, so labels never overlap.
  const labelOnMobile = (i: number) => (last - i) % 3 === 0;

  return (
    <div className="flex gap-2" role="img" aria-label={`New roles per week from the week of ${formatShortDate(weeks[0].weekStart)} to the week of ${formatShortDate(weeks[last].weekStart)}; latest week ${formatCount(weeks[last].newRoles)}.`}>
      {/* y-axis */}
      <div aria-hidden="true" className="relative h-64 w-10 shrink-0 text-right text-sm tabular-nums text-ink-3">
        {scale.ticks.map((t) => (
          <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: percent(t, scale.max) }}>
            {formatCount(t)}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-64">
          {scale.ticks.map((t) => (
            <span
              key={t}
              aria-hidden="true"
              className={`absolute inset-x-0 h-px ${t === 0 ? "bg-baseline" : "bg-grid"}`}
              style={{ bottom: percent(t, scale.max) }}
            />
          ))}
          <ol className="absolute inset-0 flex items-end">
            {weeks.map((w, i) => (
              <li key={w.weekStart} className="group relative flex h-full flex-1 items-end justify-center">
                <span className="relative flex w-full max-w-8 flex-col items-center" style={{ height: percent(w.newRoles, scale.max) }}>
                  {i === last && (
                    <span className="absolute bottom-full mb-1 text-sm font-semibold tabular-nums text-ink">{formatCount(w.newRoles)}</span>
                  )}
                  <span className="h-full w-[calc(100%-4px)] rounded-t-[4px] bg-series group-hover:opacity-80" />
                </span>
                <Tip>
                  Week of {formatShortDate(w.weekStart)}: {formatCount(w.newRoles)} new roles
                </Tip>
              </li>
            ))}
          </ol>
        </div>
        {/* Each label is centred under its column and may run past it, so narrow columns never widen the page. */}
        <ol aria-hidden="true" className="mt-3 flex text-sm text-ink-3">
          {weeks.map((w, i) => (
            <li key={w.weekStart} className={`relative h-5 min-w-0 flex-1 ${labelOnMobile(i) ? "" : "invisible lg:visible"}`}>
              <span
                className={`absolute top-0 whitespace-nowrap ${
                  i === last ? "right-0" : i === 0 ? "left-0" : "left-1/2 -translate-x-1/2"
                }`}
              >
                {formatShortDate(w.weekStart)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export interface PayRangeItem {
  key: string;
  label: string;
  currency: string;
  median: number;
  typicalLow: number;
  typicalHigh: number;
  rateSamples: number;
  platforms: number;
  /** TRD-08: false when the figure rests on too few rate samples. */
  visible: boolean;
}

/** Typical advertised range as a soft bar with the median as a dot, on one shared hourly axis. */
export function PayRanges({ items, hiddenNote }: { items: PayRangeItem[]; hiddenNote: string }) {
  const shown = items.filter((i) => i.visible);
  const currency = shown[0]?.currency ?? "USD";
  const scale = niceScale(Math.max(1, ...shown.map((i) => i.typicalHigh)), 5);
  const grid =
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1.5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_9rem]";

  const gridlines = scale.ticks.map((t) => (
    <span
      key={t}
      aria-hidden="true"
      className={`absolute inset-y-0 w-px ${t === 0 ? "bg-baseline" : "bg-grid"}`}
      style={{ left: percent(t, scale.max) }}
    />
  ));

  return (
    <div>
      <div aria-hidden="true" className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-2">
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-series" /> Median
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-7 rounded-full bg-series-soft" /> Typical range
        </span>
      </div>
      <ul role="list" className="flex flex-col gap-5 sm:gap-2">
        {items.map((item) => (
          <li key={item.key} className={`${grid} group relative rounded-lg sm:px-3 sm:py-1.5 sm:hover:bg-tint`}>
            <span className="text-base text-ink sm:truncate" title={item.label}>
              {item.label}
            </span>
            {item.visible ? (
              <>
                <span className="text-right text-base tabular-nums text-ink sm:order-last">
                  {formatMoney(item.median, item.currency)}
                  <span className="text-ink-2">
                    {" "}
                    · {formatMoney(item.typicalLow, item.currency)}–{formatMoney(item.typicalHigh, item.currency)}
                  </span>
                </span>
                <span className="relative col-span-2 h-6 sm:col-span-1">
                  {gridlines}
                  <span
                    className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-series-soft"
                    style={{ left: percent(item.typicalLow, scale.max), width: percent(item.typicalHigh - item.typicalLow, scale.max) }}
                  />
                  <span
                    className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series ring-2 ring-surface"
                    style={{ left: percent(item.median, scale.max) }}
                  />
                  <Tip>
                    {item.label}: median {formatMoney(item.median, item.currency)}, typical{" "}
                    {formatMoney(item.typicalLow, item.currency)}–{formatMoney(item.typicalHigh, item.currency)} ·{" "}
                    {formatCount(item.rateSamples)} rates from {formatCount(item.platforms)} platforms
                  </Tip>
                </span>
              </>
            ) : (
              <span className="col-span-2 text-base text-ink-2 sm:col-span-2">{hiddenNote}</span>
            )}
          </li>
        ))}
      </ul>
      {/* x-axis, aligned with the bar column */}
      <div aria-hidden="true" className={`${grid} mt-2 sm:px-3`}>
        <span className="hidden sm:block" />
        <span className="relative col-span-2 h-5 text-sm tabular-nums text-ink-3 sm:col-span-1">
          {scale.ticks.map((t, i) => (
            <span
              key={t}
              className={`absolute ${i === 0 ? "" : i === scale.ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: percent(t, scale.max) }}
            >
              {formatMoney(t, currency)}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
