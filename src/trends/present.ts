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

/** 2026-11-18T12:07:54Z → "12:07 UTC" */
export function formatUpdateTime(at: Date): string {
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  return `${time} UTC`;
}

/** How often the figures are updated, from the schedule (TRD-01): "every 6 hours". */
export function updateCadence(everyHours: number = trendsConfig.schedule.everyHours): string {
  if (everyHours === 24) return "every day";
  return everyHours === 1 ? "every hour" : `every ${everyHours} hours`;
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

const countFormat = new Intl.NumberFormat("en-US");

/** 4393 → "4,393" */
export function formatCount(n: number): string {
  return countFormat.format(n);
}

/** (75, "USD") → "$75" */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** "2026-11-02" → "2 Nov" */
export function formatShortDate(isoDate: string): string {
  return toUtcDate(isoDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Signed change with its direction, for stat tiles: (4393, 4376) → { text: "+17", direction: "up" } */
export function formatChange(current: number, previous: number): { text: string; direction: "up" | "down" | "flat" } {
  const diff = current - previous;
  if (diff === 0) return { text: "No change", direction: "flat" };
  return { text: `${diff > 0 ? "+" : "−"}${formatCount(Math.abs(diff))}`, direction: diff > 0 ? "up" : "down" };
}

/**
 * Axis scale with round tick values (1, 2, 2.5 or 5 × a power of ten) that covers `maxValue`.
 * (503, 4) → { max: 600, ticks: [0, 200, 400, 600] }
 */
export function niceScale(maxValue: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 1, ticks: [0, 1] };
  const rough = maxValue / targetTicks;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? 10 * power;
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max, ticks };
}

/** TRD-09: true when the newest snapshot is older than the configured limit. */
export function isStale(lastFetchedAt: Date, now: Date, hours: number = trendsConfig.staleAfterHours): boolean {
  return now.getTime() - lastFetchedAt.getTime() > hours * 60 * 60 * 1000;
}
