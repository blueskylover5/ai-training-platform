import { trendsConfig } from "../config";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

/** "2026-11-09" → "9 November 2026" */
export function formatDataDate(isoDate: string): string {
  return toUtcDate(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** TRD-04: the credit text shown with every chart, page, share image and export. */
export function creditLine(dataDate: string): string {
  const { name, license } = trendsConfig.credit;
  return `Data: ${name} (${license}), ${formatDataDate(dataDate)}`;
}

/**
 * TRD-03 / AT-04: one point per day from `from` to `to`.
 * Days without data stay null so charts show a gap; nothing is filled in.
 */
export function dailySeries<T>(
  points: ReadonlyArray<{ date: string; value: T }>,
  from: string,
  to: string,
): Array<{ date: string; value: T | null }> {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  const series: Array<{ date: string; value: T | null }> = [];
  for (let t = toUtcDate(from).getTime(); t <= toUtcDate(to).getTime(); t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    series.push({ date, value: byDate.has(date) ? (byDate.get(date) as T) : null });
  }
  return series;
}

export interface PayFigure {
  median: number | null;
  typicalLow: number | null;
  typicalHigh: number | null;
  rateSamples: number | null;
}

export type PublicPay =
  | { visible: true; label: string; median: number; typicalLow: number; typicalHigh: number; rateSamples: number }
  | { visible: false; reason: string };

/** TRD-07 / TRD-08: pay is "advertised", and hidden when it rests on too few rate samples. */
export function publicPay(figure: PayFigure, minSamples: number = trendsConfig.minPaySamples): PublicPay {
  const { median, typicalLow, typicalHigh, rateSamples } = figure;
  if (median === null || typicalLow === null || typicalHigh === null || rateSamples === null) {
    return { visible: false, reason: "No advertised pay data" };
  }
  if (rateSamples < minSamples) {
    return { visible: false, reason: `Too few advertised rates (fewer than ${minSamples})` };
  }
  return { visible: true, label: "Advertised hourly pay", median, typicalLow, typicalHigh, rateSamples };
}

/** TRD-09: true when the newest snapshot is older than the configured limit. */
export function isStale(lastFetchedAt: Date, now: Date, hours: number = trendsConfig.staleAfterHours): boolean {
  return now.getTime() - lastFetchedAt.getTime() > hours * 60 * 60 * 1000;
}
