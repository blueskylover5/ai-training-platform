import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/db/client";
import { trendPlatformStats, trendSnapshots } from "../../src/db/schema";
import { collectTrends } from "../../src/trends/collect";
import {
  collectPlatformStats,
  platformStatsHoldReason,
  searchCountUrl,
  windowStart,
  type PlatformStatsDeps,
} from "../../src/trends/platform-stats";
import { MemoryRawStore } from "../../src/trends/raw-store";
import { createTestDb, PAY_FIXTURE, readFixture, resetTrendTables, ROLES_FIXTURE, SEARCH_FIXTURE } from "../helpers";

const SOURCES = { roles: "https://test.invalid/roles.json", pay: "https://test.invalid/pay.json" };
const SEARCH = "https://test.invalid/api/v1/jobs";
/** Morning of the roles fixture's own date. */
const NOW = new Date("2026-11-09T06:00:00Z");

const rolesFile = JSON.parse(readFixture(ROLES_FIXTURE)) as { open_by_platform: Array<{ slug: string; open_count: number }> };
const openBySlug = new Map(rolesFile.open_by_platform.map((p) => [p.slug, p.open_count]));

/** The recorded search answer with another total. */
function searchAnswer(total: number): string {
  return JSON.stringify({ ...JSON.parse(readFixture(SEARCH_FIXTURE)), total });
}

/** A search that honours its filters: a tenth of each platform's roles are new, a quarter pay $100+. */
function honestSearch(url: URL): string {
  const open = openBySlug.get(url.searchParams.get("platform") ?? "") ?? 0;
  if (url.searchParams.has("since")) return searchAnswer(Math.floor(open / 10));
  if (url.searchParams.has("min_hourly_usd")) return searchAnswer(Math.floor(open / 4));
  return searchAnswer(open);
}

let handle: DbHandle;
let rawStore: MemoryRawStore;
let alerts: string[];
let requests: string[];
let pauses: number[];
let search: (url: URL) => string;

function deps(overrides: Partial<PlatformStatsDeps> = {}): PlatformStatsDeps {
  return {
    db: handle.db,
    rawStore,
    alert: (message) => {
      alerts.push(message);
    },
    fetchText: async (url) => {
      requests.push(url);
      return search(new URL(url));
    },
    now: () => NOW,
    sleep: async (ms) => {
      pauses.push(ms);
    },
    settings: { searchUrl: SEARCH, requestDelayMs: 5 },
    ...overrides,
  };
}

async function publishRolesFixture() {
  await collectTrends({
    db: handle.db,
    rawStore: new MemoryRawStore(),
    alert: () => {},
    sources: SOURCES,
    fetchText: async (url) => readFixture(url === SOURCES.roles ? ROLES_FIXTURE : PAY_FIXTURE),
  });
}

async function statsSnapshots() {
  return handle.db
    .select({ status: trendSnapshots.status, holdReason: trendSnapshots.holdReason })
    .from(trendSnapshots)
    .where(eq(trendSnapshots.fileKind, "platform_stats"));
}

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await resetTrendTables(handle);
  rawStore = new MemoryRawStore();
  alerts = [];
  requests = [];
  pauses = [];
  search = honestSearch;
});

describe("collectPlatformStats (TRD-11)", () => {
  it("counts open, new and big-pay roles for every platform in the newest roles file", async () => {
    await publishRolesFixture();

    const outcome = await collectPlatformStats(deps());

    expect(outcome).toMatchObject({ kind: "platform_stats", status: "published", dataDate: "2026-11-09" });
    expect(alerts).toEqual([]);

    // Three searches per platform, one role each, with a pause between searches.
    expect(requests).toHaveLength(62 * 3);
    expect(requests.slice(0, 3)).toEqual([
      `${SEARCH}?platform=invisible-technologies&limit=1`,
      `${SEARCH}?platform=invisible-technologies&since=2026-11-03&limit=1`,
      `${SEARCH}?platform=invisible-technologies&min_hourly_usd=100&limit=1`,
    ]);
    expect(pauses).toEqual(Array(62 * 3 - 1).fill(5));

    const [{ n }] = await handle.db.select({ n: count() }).from(trendPlatformStats);
    expect(n).toBe(62);
    const [invisible] = await handle.db
      .select()
      .from(trendPlatformStats)
      .where(eq(trendPlatformStats.slug, "invisible-technologies"));
    expect(invisible).toMatchObject({
      dataDate: "2026-11-09",
      name: "Invisible",
      openRoles: 533,
      newRoles: 53,
      newSince: "2026-11-03",
      bigPayRoles: 133,
      bigPayMinHourlyUsd: 100,
    });

    // The kept record has the counts and settings, never the roles in the answers (TRD-05).
    const [[key, body]] = [...rawStore.files];
    expect(key).toMatch(/^aitraining-jobs\/2026-11-09\/platform-stats-[0-9a-f]{12}\.json$/);
    const record = JSON.parse(body);
    expect(record).toMatchObject({ data_date: "2026-11-09", new_since: "2026-11-03", big_pay_min_hourly_usd: 100 });
    expect(record.platforms).toHaveLength(62);
    expect(body).not.toContain("title");
  });

  it("does not count a date twice", async () => {
    await publishRolesFixture();
    await collectPlatformStats(deps());
    requests = [];

    const again = await collectPlatformStats(deps());

    expect(again).toMatchObject({ status: "skipped", dataDate: "2026-11-09" });
    expect(requests).toEqual([]);
    expect(await statsSnapshots()).toHaveLength(1);
  });

  it("skips when the newest roles file is too old to pair with live counts", async () => {
    await publishRolesFixture();

    const outcome = await collectPlatformStats(deps({ now: () => new Date("2026-11-12T06:00:00Z") }));

    expect(outcome).toMatchObject({ status: "skipped", dataDate: "2026-11-09" });
    expect(requests).toEqual([]);
    expect(alerts).toEqual([]);
  });

  it("rejects when there is no published roles file yet", async () => {
    const outcome = await collectPlatformStats(deps());

    expect(outcome).toMatchObject({ status: "rejected" });
    expect(alerts).toHaveLength(1);
    expect(requests).toEqual([]);
  });

  it("stores nothing when one search fails", async () => {
    await publishRolesFixture();
    search = (url) => {
      if (url.searchParams.get("platform") === "mercor" && url.searchParams.has("min_hourly_usd")) {
        throw new Error(`GET ${url} answered HTTP 500`);
      }
      return honestSearch(url);
    };

    const outcome = await collectPlatformStats(deps());

    expect(outcome).toMatchObject({ status: "rejected" });
    expect(outcome.status === "rejected" && outcome.reason).toContain("HTTP 500");
    expect(alerts).toHaveLength(1);
    expect(await statsSnapshots()).toEqual([]);
    expect(rawStore.files.size).toBe(0);
  });

  it("rejects an answer without a total", async () => {
    await publishRolesFixture();
    search = () => JSON.stringify({ count: 3, roles: [] });

    const outcome = await collectPlatformStats(deps());

    expect(outcome).toMatchObject({ status: "rejected" });
    expect(outcome.status === "rejected" && outcome.reason).toContain("total");
  });

  it("holds the counts when the search seems to ignore a filter", async () => {
    await publishRolesFixture();
    // "since" ignored: every open role looks new.
    search = (url) => (url.searchParams.has("since") ? honestSearch(new URL(`${SEARCH}?platform=${url.searchParams.get("platform")}`)) : honestSearch(url));

    const outcome = await collectPlatformStats(deps());

    expect(outcome).toMatchObject({ status: "held", dataDate: "2026-11-09" });
    expect(alerts).toHaveLength(1);
    expect(await statsSnapshots()).toEqual([{ status: "held", holdReason: expect.stringContaining('"since"') }]);
  });

  it("holds the counts when the platform filter seems to be ignored", async () => {
    await publishRolesFixture();
    search = () => searchAnswer(4376);

    const outcome = await collectPlatformStats(deps());

    expect(outcome).toMatchObject({ status: "held" });
    expect(outcome.status === "held" && outcome.reason).toContain("platform filter");
  });
});

describe("platform stats helpers", () => {
  it("builds a one-role search URL", () => {
    expect(searchCountUrl(SEARCH, { platform: "mercor", since: "2026-11-03" })).toBe(
      `${SEARCH}?platform=mercor&since=2026-11-03&limit=1`,
    );
  });

  it("finds the first day of a window that ends on the data date", () => {
    expect(windowStart("2026-11-10", 7)).toBe("2026-11-04");
    expect(windowStart("2026-03-01", 2)).toBe("2026-02-28");
    expect(windowStart("2026-11-10", 1)).toBe("2026-11-10");
  });

  it("accepts plausible counts", () => {
    const counts = [
      { slug: "a", name: "A", openRoles: 100, newRoles: 10, bigPayRoles: 30 },
      { slug: "b", name: "B", openRoles: 50, newRoles: 0, bigPayRoles: 0 },
    ];
    expect(platformStatsHoldReason(counts, 140, 0.5)).toBeNull();
    expect(platformStatsHoldReason([], 0, 0.5)).toBeNull();
  });
});
