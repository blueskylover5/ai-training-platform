import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/db/client";
import { collectTrends, type CollectDeps } from "../../src/trends/collect";
import { collectPlatformStats } from "../../src/trends/platform-stats";
import { getPlatformGuide, getPlatformRace, getTrendsOverview } from "../../src/trends/queries";
import { MemoryRawStore } from "../../src/trends/raw-store";
import { createTestDb, PAY_FIXTURE, readFixture, resetTrendTables, ROLES_FIXTURE } from "../helpers";

const SOURCES = { roles: "https://test.invalid/roles.json", pay: "https://test.invalid/pay.json" };

let handle: DbHandle;

/** Collects the given files into the test database. */
async function collect(roles: string, pay: string) {
  const deps: CollectDeps = {
    db: handle.db,
    rawStore: new MemoryRawStore(),
    alert: () => {},
    sources: SOURCES,
    fetchText: async (url) => (url === SOURCES.roles ? roles : pay),
  };
  return collectTrends(deps);
}

/** The recorded file moved to another date and edited. */
function fileFor(name: string, date: string, edit: (file: Record<string, any>) => void = () => {}): string {
  const file = JSON.parse(readFixture(name));
  file.temporal_coverage = date;
  edit(file);
  return JSON.stringify(file);
}

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await resetTrendTables(handle);
});

describe("getTrendsOverview", () => {
  it("returns null before anything is published", async () => {
    expect(await getTrendsOverview(handle.db, { weeks: 12 })).toBeNull();
  });

  it("reads the newest published files, sorted for the charts", async () => {
    await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));

    const overview = await getTrendsOverview(handle.db, { weeks: 12 });

    expect(overview).not.toBeNull();
    const { roles, pay, weekly } = overview!;
    expect(roles.dataDate).toBe("2026-11-09");
    expect(roles.totals).toEqual({ dataDate: "2026-11-09", openRoles: 4376, platformsLive: 62, newLast7d: 388 });
    expect(roles.previous).toBeNull();
    expect(roles.workTypes).toHaveLength(12);
    expect(roles.workTypes[0]).toEqual({ slug: "domain-expert", label: "Law, Medicine & Finance", openCount: 1611 });
    expect(roles.platforms).toHaveLength(62);
    const counts = roles.platforms.map((p) => p.openCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(pay?.dataDate).toBe("2026-11-09");
    expect(pay?.rows).toHaveLength(12);
    expect(pay?.rows[0].median).toBe(75);
    expect(weekly).toHaveLength(11);
    expect(weekly.at(-1)).toEqual({ weekStart: "2026-11-02", newRoles: 503 });
    expect(weekly[0].weekStart < weekly[1].weekStart).toBe(true);
  });

  it("compares with the previous published day and ignores held files (TRD-02)", async () => {
    await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));
    await collect(
      fileFor(ROLES_FIXTURE, "2026-11-10", (f) => {
        f.totals.open_roles = 4393;
      }),
      fileFor(PAY_FIXTURE, "2026-11-10"),
    );
    // A jump of more than 50% is held, so the overview must keep showing 10 November.
    const held = await collect(
      fileFor(ROLES_FIXTURE, "2026-11-11", (f) => {
        f.totals.open_roles = 9000;
      }),
      fileFor(PAY_FIXTURE, "2026-11-11"),
    );
    expect(held[0].status).toBe("held");

    const overview = await getTrendsOverview(handle.db, { weeks: 12 });

    expect(overview?.roles.dataDate).toBe("2026-11-10");
    expect(overview?.roles.totals.openRoles).toBe(4393);
    expect(overview?.roles.previous?.dataDate).toBe("2026-11-09");
    expect(overview?.roles.previous?.openRoles).toBe(4376);
    expect(overview?.pay?.dataDate).toBe("2026-11-11");
  });

  it("limits the weekly chart to the most recent weeks", async () => {
    await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));
    const overview = await getTrendsOverview(handle.db, { weeks: 4 });
    expect(overview?.weekly.map((w) => w.weekStart)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
  });
});

describe("getPlatformRace (TRD-11)", () => {
  /** Job-search counts for the roles fixture: a tenth of each platform's roles are new, a quarter pay $100+. */
  async function collectStats(hold = false) {
    const open = new Map<string, number>(
      JSON.parse(readFixture(ROLES_FIXTURE)).open_by_platform.map((p: { slug: string; open_count: number }) => [p.slug, p.open_count]),
    );
    return collectPlatformStats({
      db: handle.db,
      rawStore: new MemoryRawStore(),
      alert: () => {},
      now: () => new Date("2026-11-09T06:00:00Z"),
      sleep: async () => {},
      settings: { searchUrl: "https://test.invalid/api/v1/jobs" },
      fetchText: async (url) => {
        const params = new URL(url).searchParams;
        const n = open.get(params.get("platform") ?? "") ?? 0;
        const total = params.has("since") ? (hold ? n : Math.floor(n / 10)) : params.has("min_hourly_usd") ? Math.floor(n / 4) : n;
        return JSON.stringify({ total, roles: [] });
      },
    });
  }

  it("returns null before anything is published", async () => {
    expect(await getPlatformRace(handle.db)).toBeNull();
  });

  it("has open roles only until the first job-search counts arrive", async () => {
    await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));

    const race = await getPlatformRace(handle.db);

    expect(race?.roles.dataDate).toBe("2026-11-09");
    expect(race?.stats).toBeNull();
    expect(race?.platforms).toHaveLength(62);
    expect(race?.platforms[0]).toEqual({ slug: "invisible-technologies", name: "Invisible", openRoles: 533, stats: null });
  });

  it("joins the published job-search counts to each platform", async () => {
    await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));
    await collectStats();

    const race = await getPlatformRace(handle.db);

    expect(race?.stats).toMatchObject({ dataDate: "2026-11-09", newSince: "2026-11-03", bigPayMinHourlyUsd: 100 });
    expect(race?.platforms[0]).toEqual({
      slug: "invisible-technologies",
      name: "Invisible",
      openRoles: 533,
      stats: { openRoles: 533, newRoles: 53, bigPayRoles: 133 },
    });
  });

  it("ignores held counts", async () => {
    await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));
    expect(await collectStats(true)).toMatchObject({ status: "held" });

    const race = await getPlatformRace(handle.db);

    expect(race?.stats).toBeNull();
  });

  describe("getPlatformGuide", () => {
    it("returns null before anything is published", async () => {
      expect(await getPlatformGuide(handle.db)).toBeNull();
    });

    it("reads the same figures as the overview and the race, in one go", async () => {
      await collect(readFixture(ROLES_FIXTURE), readFixture(PAY_FIXTURE));
      await collectStats();

      const guide = await getPlatformGuide(handle.db);
      const overview = await getTrendsOverview(handle.db, { weeks: 4 });
      const race = await getPlatformRace(handle.db);

      expect(guide?.roles).toEqual({
        dataDate: overview?.roles.dataDate,
        fetchedAt: overview?.roles.fetchedAt,
        totals: overview?.roles.totals,
        workTypes: overview?.roles.workTypes,
      });
      expect(guide?.pay).toEqual(overview?.pay);
      expect(guide?.race).toEqual(race);
    });
  });
});
