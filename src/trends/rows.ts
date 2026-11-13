import type {
  trendPay,
  trendPlatforms,
  trendTotals,
  trendWeekly,
  trendWorkTypes,
} from "../db/schema";
import type { PayFile, RolesFile } from "./schema";

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"];

export interface RolesRows {
  totals: Insert<typeof trendTotals>;
  workTypes: Insert<typeof trendWorkTypes>[];
  platforms: Insert<typeof trendPlatforms>[];
  weekly: Insert<typeof trendWeekly>[];
}

/** Maps a validated roles.json file to database rows for one snapshot. */
export function rolesRows(file: RolesFile, snapshotId: number): RolesRows {
  const dataDate = file.temporal_coverage;
  return {
    totals: {
      snapshotId,
      dataDate,
      openRoles: file.totals.open_roles,
      platformsLive: file.totals.platforms_live,
      newLast7d: file.totals.new_last_7d,
    },
    workTypes: file.open_by_work_type.map((w) => ({
      snapshotId,
      dataDate,
      slug: w.slug,
      label: w.label,
      openCount: w.open_count,
      currency: w.currency ?? null,
      unit: w.unit ?? null,
      median: w.median ?? null,
      typicalLow: w.typical_low ?? null,
      typicalHigh: w.typical_high ?? null,
      rateSamples: w.rate_samples ?? null,
      platforms: w.platforms ?? null,
    })),
    platforms: file.open_by_platform.map((p) => ({
      snapshotId,
      dataDate,
      slug: p.slug,
      name: p.name,
      openCount: p.open_count,
    })),
    weekly: file.recent_market_momentum.weekly.map((w) => ({
      weekStart: w.week_start,
      newRoles: w.new_roles,
      asOfDate: dataDate,
      snapshotId,
    })),
  };
}

/** Maps a validated pay.json file to database rows for one snapshot. */
export function payRows(file: PayFile, snapshotId: number): Insert<typeof trendPay>[] {
  const dataDate = file.temporal_coverage;
  return file.pay_by_work_type.map((p) => ({
    snapshotId,
    dataDate,
    slug: p.slug,
    label: p.label,
    currency: p.currency,
    unit: p.unit,
    median: p.median,
    typicalLow: p.typical_low,
    typicalHigh: p.typical_high,
    rateSamples: p.rate_samples,
    platforms: p.platforms,
    openTotal: p.open_total ?? null,
    unpriced: p.unpriced ?? null,
  }));
}
