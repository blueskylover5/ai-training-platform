import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { trendsConfig } from "../config";
import type { Db } from "../db/client";
import { trendPlatforms, trendPlatformStats, trendSnapshots } from "../db/schema";
import type { CollectOutcome } from "./collect";
import type { FetchText } from "./fetch";
import type { RawStore } from "./raw-store";
import { describeIssues } from "./schema";

/**
 * TRD-11: per-platform counts from the AITraining.jobs job search, collected once a day right
 * after roles.json (ADR 0004). For every platform in the newest published roles file we run
 * three searches and keep only each search's `total`: open roles, roles first listed in the
 * last N days, and roles whose advertised hourly pay reaches a threshold. Roles are never stored.
 */

/** The part of a job-search answer we use. The roles in it are ignored. */
export const searchCountSchema = z.object({
  total: z.number().int().nonnegative(),
  roles: z.array(z.unknown()),
});

export interface PlatformStatsSettings {
  searchUrl: string;
  newWindowDays: number;
  bigPayMinHourlyUsd: number;
  requestDelayMs: number;
  maxLagDays: number;
  /** Hold when the searches add up to a total this far from roles.json (as in TRD-02). */
  maxTotalChangeRatio: number;
}

export interface PlatformStatsDeps {
  db: Db;
  fetchText: FetchText;
  rawStore: RawStore;
  /** Notifies the team. Called when the counts are rejected or held. */
  alert: (message: string) => void | Promise<void>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  settings?: Partial<PlatformStatsSettings>;
}

export interface PlatformStatsCounts {
  slug: string;
  name: string;
  openRoles: number;
  newRoles: number;
  bigPayRoles: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function defaultSettings(): PlatformStatsSettings {
  const { searchUrl, newWindowDays, bigPayMinHourlyUsd, requestDelayMs, maxLagDays } = trendsConfig.platformStats;
  return {
    searchUrl,
    newWindowDays,
    bigPayMinHourlyUsd,
    requestDelayMs,
    maxLagDays,
    maxTotalChangeRatio: trendsConfig.maxTotalChangeRatio,
  };
}

/** A search for one count: only the total matters, so ask for a single role. */
export function searchCountUrl(base: string, filters: Record<string, string | number>): string {
  const url = new URL(base);
  for (const [name, value] of Object.entries(filters)) url.searchParams.set(name, String(value));
  url.searchParams.set("limit", "1");
  return url.toString();
}

/** First day of an N-day window that ends on `endDate`: ("2026-11-10", 7) → "2026-11-04". */
export function windowStart(endDate: string, days: number): string {
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return new Date(end - (days - 1) * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(
    (new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) / DAY_MS,
  );
}

/**
 * Returns why the counts look wrong, or null. Large mistakes usually mean the search stopped
 * honouring a filter, so the counts are held for review instead of published.
 */
export function platformStatsHoldReason(
  counts: PlatformStatsCounts[],
  rolesFileOpenRoles: number,
  maxRatio: number,
): string | null {
  const sum = (pick: (c: PlatformStatsCounts) => number) => counts.reduce((total, c) => total + pick(c), 0);
  const open = sum((c) => c.openRoles);
  const fresh = sum((c) => c.newRoles);
  const bigPay = sum((c) => c.bigPayRoles);

  if (rolesFileOpenRoles > 0) {
    const change = Math.abs(open - rolesFileOpenRoles) / rolesFileOpenRoles;
    if (change > maxRatio) {
      return `the platform searches add up to ${open} open roles but roles.json lists ${rolesFileOpenRoles} (${Math.round(change * 100)}% apart); the platform filter may have stopped working`;
    }
  }
  if (open > 0 && fresh >= open) {
    return `all ${open} open roles count as new; the "since" filter may have stopped working`;
  }
  if (open > 0 && bigPay >= open) {
    return `all ${open} open roles count as big pay; the pay filter may have stopped working`;
  }
  return null;
}

export async function collectPlatformStats(deps: PlatformStatsDeps): Promise<CollectOutcome> {
  const kind = "platform_stats" as const;
  const settings = { ...defaultSettings(), ...deps.settings };
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now?.() ?? new Date();
  const today = now.toISOString().slice(0, 10);

  const reject = async (reason: string): Promise<CollectOutcome> => {
    await deps.alert(`[trends] platform counts rejected: ${reason}`);
    return { kind, status: "rejected", reason };
  };

  const [roles] = await deps.db
    .select({ id: trendSnapshots.id, dataDate: trendSnapshots.dataDate })
    .from(trendSnapshots)
    .where(and(eq(trendSnapshots.fileKind, "roles"), eq(trendSnapshots.status, "published")))
    .orderBy(desc(trendSnapshots.dataDate))
    .limit(1);
  if (!roles) return reject("there is no published roles file to take the platform list from");

  const dataDate = roles.dataDate;
  // The search is live, so its counts only describe a roles file from about today.
  if (daysBetween(dataDate, today) > settings.maxLagDays) {
    return {
      kind,
      status: "skipped",
      dataDate,
      reason: `the newest roles file is from ${dataDate}, too old to pair with today's live search counts`,
    };
  }

  const existing = await deps.db
    .select({ id: trendSnapshots.id })
    .from(trendSnapshots)
    .where(and(eq(trendSnapshots.dataDate, dataDate), eq(trendSnapshots.fileKind, kind)))
    .limit(1);
  if (existing.length > 0) {
    return { kind, status: "skipped", dataDate, reason: "platform counts for this date are already stored" };
  }

  const platforms = await deps.db
    .select({ slug: trendPlatforms.slug, name: trendPlatforms.name, openCount: trendPlatforms.openCount })
    .from(trendPlatforms)
    .where(eq(trendPlatforms.snapshotId, roles.id))
    .orderBy(desc(trendPlatforms.openCount), trendPlatforms.slug);

  const newSince = windowStart(dataDate, settings.newWindowDays);
  let searches = 0;
  const countRoles = async (filters: Record<string, string | number>): Promise<number> => {
    if (searches++ > 0) await sleep(settings.requestDelayMs);
    const url = searchCountUrl(settings.searchUrl, filters);
    const text = await deps.fetchText(url);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${url} did not answer with JSON`);
    }
    const parsed = searchCountSchema.safeParse(json);
    if (!parsed.success) throw new Error(`${url}: ${describeIssues(parsed.error)}`);
    return parsed.data.total;
  };

  const counts: PlatformStatsCounts[] = [];
  try {
    for (const platform of platforms) {
      counts.push({
        slug: platform.slug,
        name: platform.name,
        openRoles: await countRoles({ platform: platform.slug }),
        newRoles: await countRoles({ platform: platform.slug, since: newSince }),
        bigPayRoles: await countRoles({ platform: platform.slug, min_hourly_usd: settings.bigPayMinHourlyUsd }),
      });
    }
  } catch (error) {
    return reject(`a search failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rolesFileOpenRoles = platforms.reduce((total, p) => total + p.openCount, 0);
  const holdReason = platformStatsHoldReason(counts, rolesFileOpenRoles, settings.maxTotalChangeRatio);

  // Our own record of what was counted and how, kept like a downloaded file (TRD-01).
  const text = JSON.stringify(
    {
      source: settings.searchUrl,
      data_date: dataDate,
      collected_at: now.toISOString(),
      new_since: newSince,
      big_pay_min_hourly_usd: settings.bigPayMinHourlyUsd,
      platforms: counts.map((c) => ({
        slug: c.slug,
        name: c.name,
        open_roles: c.openRoles,
        new_roles: c.newRoles,
        big_pay_roles: c.bigPayRoles,
      })),
    },
    null,
    2,
  );
  const sha256 = createHash("sha256").update(text).digest("hex");
  const rawKey = `aitraining-jobs/${dataDate}/platform-stats-${sha256.slice(0, 12)}.json`;
  await deps.rawStore.put(rawKey, text);

  const snapshotId = await deps.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(trendSnapshots)
      .values({
        dataDate,
        fileKind: kind,
        sourceUrl: settings.searchUrl,
        rawKey,
        sha256,
        status: holdReason === null ? "published" : "held",
        holdReason,
      })
      .onConflictDoNothing()
      .returning({ id: trendSnapshots.id });
    const row = inserted[0];
    if (!row) return null; // another run stored this date first
    if (counts.length > 0) {
      await tx.insert(trendPlatformStats).values(
        counts.map((c) => ({
          snapshotId: row.id,
          dataDate,
          slug: c.slug,
          name: c.name,
          openRoles: c.openRoles,
          newRoles: c.newRoles,
          newSince,
          bigPayRoles: c.bigPayRoles,
          bigPayMinHourlyUsd: settings.bigPayMinHourlyUsd,
        })),
      );
    }
    return row.id;
  });

  if (snapshotId === null) {
    return { kind, status: "skipped", dataDate, reason: "platform counts for this date are already stored" };
  }
  if (holdReason !== null) {
    await deps.alert(`[trends] platform counts for ${dataDate} held, not published: ${holdReason}`);
    return { kind, status: "held", dataDate, snapshotId, reason: holdReason };
  }
  return { kind, status: "published", dataDate, snapshotId };
}
