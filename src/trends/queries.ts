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
    /** When AITraining.jobs built that file (its `updated` time), or when we fetched it if that is unknown. */
    updatedAt: Date;
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
    .select({
      id: trendSnapshots.id,
      dataDate: trendSnapshots.dataDate,
      fetchedAt: trendSnapshots.fetchedAt,
      sourceUpdatedAt: trendSnapshots.sourceUpdatedAt,
    })
    .from(trendSnapshots)
    .where(and(eq(trendSnapshots.fileKind, kind), eq(trendSnapshots.status, "published")))
    .orderBy(desc(trendSnapshots.dataDate))
    .limit(limit);
}

/** When the source built a snapshot's file, falling back to when we fetched it. */
function updatedAtOf(snapshot: { fetchedAt: Date; sourceUpdatedAt: Date | null }): Date {
  return snapshot.sourceUpdatedAt ?? snapshot.fetchedAt;
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

async function workTypesFor(db: Db, snapshotId: number): Promise<WorkTypeCount[]> {
  return db
    .select({ slug: trendWorkTypes.slug, label: trendWorkTypes.label, openCount: trendWorkTypes.openCount })
    .from(trendWorkTypes)
    .where(eq(trendWorkTypes.snapshotId, snapshotId))
    .orderBy(desc(trendWorkTypes.openCount), asc(trendWorkTypes.label));
}

async function platformsFor(db: Db, snapshotId: number): Promise<PlatformCount[]> {
  return db
    .select({ slug: trendPlatforms.slug, name: trendPlatforms.name, openCount: trendPlatforms.openCount })
    .from(trendPlatforms)
    .where(eq(trendPlatforms.snapshotId, snapshotId))
    .orderBy(desc(trendPlatforms.openCount), asc(trendPlatforms.name));
}

async function latestPay(db: Db): Promise<TrendsOverview["pay"]> {
  const [latest] = await latestPublished(db, "pay", 1);
  if (!latest) return null;
  const rows = await db
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
    .where(eq(trendPay.snapshotId, latest.id))
    .orderBy(desc(trendPay.median), asc(trendPay.label));
  return { dataDate: latest.dataDate, rows };
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

  const recentWeeks = await db
    .select({ weekStart: trendWeekly.weekStart, newRoles: trendWeekly.newRoles })
    .from(trendWeekly)
    .orderBy(desc(trendWeekly.weekStart))
    .limit(options.weeks);

  return {
    roles: {
      dataDate: latestRoles.dataDate,
      fetchedAt: latestRoles.fetchedAt,
      updatedAt: updatedAtOf(latestRoles),
      totals,
      previous,
      workTypes: await workTypesFor(db, latestRoles.id),
      platforms: await platformsFor(db, latestRoles.id),
    },
    pay: await latestPay(db),
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

/** The platforms of one roles snapshot joined to the newest published job-search counts (TRD-11). */
async function raceFor(
  db: Db,
  roles: { id: number; dataDate: string; fetchedAt: Date },
  platforms: PlatformCount[],
): Promise<PlatformRaceData> {
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
    roles: { dataDate: roles.dataDate, fetchedAt: roles.fetchedAt },
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

/**
 * Everything the platform race page shows (TRD-11), from published snapshots only.
 * Returns null until the first roles file has been published.
 */
export async function getPlatformRace(db: Db): Promise<PlatformRaceData | null> {
  const [latestRoles] = await latestPublished(db, "roles", 1);
  if (!latestRoles) return null;
  return raceFor(db, latestRoles, await platformsFor(db, latestRoles.id));
}

export interface PlatformGuideData {
  /** Newest published roles file: headline figures and open roles by sector. */
  roles: { dataDate: string; fetchedAt: Date; updatedAt: Date; totals: TotalsFigures; workTypes: WorkTypeCount[] };
  /** Newest published pay file, if any. */
  pay: TrendsOverview["pay"];
  /** The platform race, built on the same roles file. */
  race: PlatformRaceData;
}

/**
 * Everything the Platform guide page shows, read once inside one read-only transaction, so every
 * section describes the same published files even while an update is being stored.
 * Returns null until the first roles file has been published.
 */
export async function getPlatformGuide(db: Db): Promise<PlatformGuideData | null> {
  return db.transaction(
    async (tx) => {
      const [latestRoles] = await latestPublished(tx, "roles", 1);
      if (!latestRoles) return null;
      const totals = await totalsFor(tx, latestRoles.id);
      if (!totals) return null;
      const workTypes = await workTypesFor(tx, latestRoles.id);
      const platforms = await platformsFor(tx, latestRoles.id);
      return {
        roles: {
          dataDate: latestRoles.dataDate,
          fetchedAt: latestRoles.fetchedAt,
          updatedAt: updatedAtOf(latestRoles),
          totals,
          workTypes,
        },
        pay: await latestPay(tx),
        race: await raceFor(tx, latestRoles, platforms),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
