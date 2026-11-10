import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/db/client";
import { collectTrends, type CollectDeps } from "../../src/trends/collect";
import { getTrendsOverview } from "../../src/trends/queries";
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
