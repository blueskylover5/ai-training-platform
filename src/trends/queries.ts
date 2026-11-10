import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  trendPay,
  trendPlatforms,
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

async function latestPublished(db: Db, kind: "roles" | "pay", limit: number) {
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
