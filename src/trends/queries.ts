import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  trendPay,
  trendPlatforms,
  trendPlatformStats,
  trendSnapshots,
  trendTotals,
  trendWeekly,
  trendWorkTypes,
} from "../db/schema";

export interface TotalsFigures {
  dataDate: string;
  openRoles: number;
  platformsLive: number;
  newLast7d: number;
}

export interface WorkTypeCount {
  slug: string;
  label: string;
  openCount: number;
}

export interface PlatformCount {
  slug: string;
  name: string;
  openCount: number;
}

export interface PayRow {
  slug: string;
  label: string;
  currency: string;
  unit: string;
  median: number;
  typicalLow: number;
  typicalHigh: number;
  rateSamples: number;
  platforms: number;
}

export interface WeekPoint {
  weekStart: string;
  newRoles: number;
}

export interface TrendsOverview {
  /** Newest published roles file. */
  roles: {
    dataDate: string;
    fetchedAt: Date;
    totals: TotalsFigures;
    /** The published roles file before it, for day-on-day changes. */
    previous: TotalsFigures | null;
    workTypes: WorkTypeCount[];
    platforms: PlatformCount[];
  };
  /** Newest published pay file, if any. */
  pay: { dataDate: string; rows: PayRow[] } | null;
  /** The most recent weeks of new roles, oldest first. */
  weekly: WeekPoint[];
}

async function latestPublished(db: Db, kind: "roles" | "pay" | "platform_stats", limit: number) {
  return db
    .select({ id: trendSnapshots.id, dataDate: trendSnapshots.dataDate, fetchedAt: trendSnapshots.fetchedAt })
    .from(trendSnapshots)
    .where(and(eq(trendSnapshots.fileKind, kind), eq(trendSnapshots.status, "published")))
    .orderBy(desc(trendSnapshots.dataDate))
    .limit(limit);
}

async function totalsFor(db: Db, snapshotId: number): Promise<TotalsFigures | null> {
  const [row] = await db
    .select({
      dataDate: trendTotals.dataDate,
      openRoles: trendTotals.openRoles,
      platformsLive: trendTotals.platformsLive,
      newLast7d: trendTotals.newLast7d,
    })
    .from(trendTotals)
    .where(eq(trendTotals.snapshotId, snapshotId));
  return row ?? null;
}

/**
 * Everything the trends overview shows, read from published snapshots only (TRD-02).
 * Returns null until the first roles file has been published.
 */
export async function getTrendsOverview(db: Db, options: { weeks: number }): Promise<TrendsOverview | null> {
  const [latestRoles, previousRoles] = await latestPublished(db, "roles", 2);
  if (!latestRoles) return null;

  const totals = await totalsFor(db, latestRoles.id);
  if (!totals) return null;
  const previous = previousRoles ? await totalsFor(db, previousRoles.id) : null;

  const workTypes = await db
    .select({ slug: trendWorkTypes.slug, label: trendWorkTypes.label, openCount: trendWorkTypes.openCount })
    .from(trendWorkTypes)
    .where(eq(trendWorkTypes.snapshotId, latestRoles.id))
    .orderBy(desc(trendWorkTypes.openCount), asc(trendWorkTypes.label));

  const platforms = await db
    .select({ slug: trendPlatforms.slug, name: trendPlatforms.name, openCount: trendPlatforms.openCount })
    .from(trendPlatforms)
    .where(eq(trendPlatforms.snapshotId, latestRoles.id))
    .orderBy(desc(trendPlatforms.openCount), asc(trendPlatforms.name));

  const [latestPay] = await latestPublished(db, "pay", 1);
  const pay = latestPay
    ? {
        dataDate: latestPay.dataDate,
        rows: await db
          .select({
            slug: trendPay.slug,
            label: trendPay.label,
            currency: trendPay.currency,
            unit: trendPay.unit,
            median: trendPay.median,
            typicalLow: trendPay.typicalLow,
            typicalHigh: trendPay.typicalHigh,
            rateSamples: trendPay.rateSamples,
            platforms: trendPay.platforms,
          })
          .from(trendPay)
          .where(eq(trendPay.snapshotId, latestPay.id))
          .orderBy(desc(trendPay.median), asc(trendPay.label)),
      }
    : null;

  const recentWeeks = await db
    .select({ weekStart: trendWeekly.weekStart, newRoles: trendWeekly.newRoles })
    .from(trendWeekly)
    .orderBy(desc(trendWeekly.weekStart))
    .limit(options.weeks);

  return {
    roles: { dataDate: latestRoles.dataDate, fetchedAt: latestRoles.fetchedAt, totals, previous, workTypes, platforms },
    pay,
    weekly: recentWeeks.reverse(),
  };
}

export interface RacePlatform {
  slug: string;
  name: string;
  /** From roles.json. */
  openRoles: number;
  /** From the job-search counts (TRD-11); null when this platform has none. */
  stats: { openRoles: number; newRoles: number; bigPayRoles: number } | null;
}

export interface PlatformRaceData {
  roles: { dataDate: string; fetchedAt: Date };
  /** Newest published job-search counts, or null before the first one. */
  stats: { dataDate: string; fetchedAt: Date; newSince: string; bigPayMinHourlyUsd: number } | null;
  /** Every platform in the newest roles file, most open roles first. */
  platforms: RacePlatform[];
}

/**
 * Everything the platform race page shows (TRD-11), from published snapshots only.
 * Returns null until the first roles file has been published.
 */
export async function getPlatformRace(db: Db): Promise<PlatformRaceData | null> {
  const [latestRoles] = await latestPublished(db, "roles", 1);
  if (!latestRoles) return null;

  const platforms = await db
    .select({ slug: trendPlatforms.slug, name: trendPlatforms.name, openCount: trendPlatforms.openCount })
    .from(trendPlatforms)
    .where(eq(trendPlatforms.snapshotId, latestRoles.id))
    .orderBy(desc(trendPlatforms.openCount), asc(trendPlatforms.name));

  const [latestStats] = await latestPublished(db, "platform_stats", 1);
  const statsRows = latestStats
    ? await db
        .select({
          slug: trendPlatformStats.slug,
          openRoles: trendPlatformStats.openRoles,
          newRoles: trendPlatformStats.newRoles,
          newSince: trendPlatformStats.newSince,
          bigPayRoles: trendPlatformStats.bigPayRoles,
          bigPayMinHourlyUsd: trendPlatformStats.bigPayMinHourlyUsd,
        })
        .from(trendPlatformStats)
        .where(eq(trendPlatformStats.snapshotId, latestStats.id))
    : [];
  const bySlug = new Map(statsRows.map((row) => [row.slug, row]));
  const first = statsRows[0];

  return {
    roles: { dataDate: latestRoles.dataDate, fetchedAt: latestRoles.fetchedAt },
    stats:
      latestStats && first
        ? {
            dataDate: latestStats.dataDate,
            fetchedAt: latestStats.fetchedAt,
            newSince: first.newSince,
            bigPayMinHourlyUsd: first.bigPayMinHourlyUsd,
          }
        : null,
    platforms: platforms.map((p) => {
      const row = bySlug.get(p.slug);
      return {
        slug: p.slug,
        name: p.name,
        openRoles: p.openCount,
        stats: row ? { openRoles: row.openRoles, newRoles: row.newRoles, bigPayRoles: row.bigPayRoles } : null,
      };
    }),
  };
}
