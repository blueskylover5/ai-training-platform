import { count, eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/db/client";
import {
  trendPay,
  trendPlatforms,
  trendSnapshots,
  trendTotals,
  trendWeekly,
  trendWorkTypes,
} from "../../src/db/schema";
import { collectTrends, type CollectDeps } from "../../src/trends/collect";
import { MemoryRawStore } from "../../src/trends/raw-store";
import { lastCollectedAt } from "../../src/trends/schedule";
import { createTestDb, PAY_FIXTURE, readFixture, resetTrendTables, ROLES_FIXTURE } from "../helpers";

const SOURCES = { roles: "https://test.invalid/roles.json", pay: "https://test.invalid/pay.json" };

let handle: DbHandle;
let rawStore: MemoryRawStore;
let alerts: string[];
let served: { roles: string; pay: string };

function deps(): CollectDeps {
  return {
    db: handle.db,
    rawStore,
    alert: (message) => {
      alerts.push(message);
    },
    sources: SOURCES,
    fetchText: async (url) => (url === SOURCES.roles ? served.roles : served.pay),
  };
}

/** The recorded roles.json, moved to another date and edited. */
function rolesFor(date: string, edit: (file: Record<string, any>) => void = () => {}): string {
  const file = JSON.parse(readFixture(ROLES_FIXTURE));
  file.temporal_coverage = date;
  edit(file);
  return JSON.stringify(file);
}

/** The recorded pay.json, moved to another date. */
function payFor(date: string): string {
  return JSON.stringify({ ...JSON.parse(readFixture(PAY_FIXTURE)), temporal_coverage: date });
}

/** The roles.json for the fixture's own date as the source rebuilds it later that day. */
function laterSameDay(edit: (file: Record<string, any>) => void = () => {}): string {
  return rolesFor("2026-11-09", (f) => {
    f.updated = "2026-11-09T14:07:00+00:00";
    edit(f);
  });
}

async function rolesSnapshots() {
  return handle.db.select().from(trendSnapshots).where(eq(trendSnapshots.fileKind, "roles")).orderBy(trendSnapshots.dataDate);
}

async function openRolesOn(date: string) {
  const [row] = await handle.db.select().from(trendTotals).where(eq(trendTotals.dataDate, date));
  return row?.openRoles;
}

async function rowCount(table: PgTable) {
  const [row] = await handle.db.select({ n: count() }).from(table);
  return row?.n ?? 0;
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
  served = { roles: readFixture(ROLES_FIXTURE), pay: readFixture(PAY_FIXTURE) };
});

describe("collectTrends", () => {
  it("stores and publishes both files (TRD-01)", async () => {
    const outcomes = await collectTrends(deps());

    expect(outcomes.map((o) => [o.kind, o.status])).toEqual([
      ["roles", "published"],
      ["pay", "published"],
    ]);
    expect(await rowCount(trendSnapshots)).toBe(2);
    expect(await rowCount(trendTotals)).toBe(1);
    expect(await rowCount(trendWorkTypes)).toBe(12);
    expect(await rowCount(trendPlatforms)).toBe(62);
    expect(await rowCount(trendPay)).toBe(12);
    expect(await rowCount(trendWeekly)).toBe(11);
    expect(rawStore.files.size).toBe(2);
    expect(alerts).toEqual([]);

    const [domain] = await handle.db
      .select()
      .from(trendWorkTypes)
      .where(eq(trendWorkTypes.slug, "domain-expert"));
    expect(domain).toMatchObject({ openCount: 1611, median: 75, typicalLow: 40, typicalHigh: 150 });
  });

  it("AT-01: running twice with unchanged files keeps one snapshot per date", async () => {
    await collectTrends(deps());
    const second = await collectTrends(deps());

    expect(second).toMatchObject([
      { status: "skipped", reason: "this file is already stored" },
      { status: "skipped", reason: "this file is already stored" },
    ]);
    expect(await rowCount(trendSnapshots)).toBe(2);
    expect(await rowCount(trendWorkTypes)).toBe(12);
  });

  it("AT-02: holds a snapshot when total open roles jumps more than 50%", async () => {
    await collectTrends(deps());
    served.roles = rolesFor("2026-11-10", (f) => {
      f.totals.open_roles = 8000;
      f.recent_market_momentum.weekly.at(-1).new_roles = 999;
    });
    served.pay = JSON.stringify({ ...JSON.parse(served.pay), temporal_coverage: "2026-11-10" });

    const [roles] = await collectTrends(deps());

    expect(roles).toMatchObject({ kind: "roles", status: "held", dataDate: "2026-11-10" });
    expect(alerts.join("\n")).toMatch(/held, not published: total open roles changed 83%/);
    // A held file must not change the shared weekly figures.
    const [lastWeek] = await handle.db
      .select()
      .from(trendWeekly)
      .where(eq(trendWeekly.weekStart, "2026-11-02"));
    expect(lastWeek).toMatchObject({ newRoles: 503, asOfDate: "2026-11-09" });
  });

  it("AT-02: rejects a file whose schema changed, stores nothing and alerts", async () => {
    served.roles = rolesFor("2026-11-09", (f) => {
      delete f.totals;
    });

    const [roles, pay] = await collectTrends(deps());

    expect(roles).toMatchObject({ kind: "roles", status: "rejected" });
    expect(pay).toMatchObject({ kind: "pay", status: "published" });
    expect(await rowCount(trendTotals)).toBe(0);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/roles\.json rejected: schema check failed: totals/);
  });

  it("rejects a file that is not JSON", async () => {
    served.pay = "<html>Service unavailable</html>";
    const [, pay] = await collectTrends(deps());
    expect(pay).toMatchObject({ status: "rejected", reason: "the file is not valid JSON" });
  });

  it("rejects and alerts when the download fails", async () => {
    const failing: CollectDeps = {
      ...deps(),
      fetchText: async () => {
        throw new Error("GET answered HTTP 503");
      },
    };
    const outcomes = await collectTrends(failing);
    expect(outcomes.map((o) => o.status)).toEqual(["rejected", "rejected"]);
    expect(alerts).toHaveLength(2);
  });

  it("lets a newer published file update a week's figure", async () => {
    await collectTrends(deps());
    served.roles = rolesFor("2026-11-10", (f) => {
      f.totals.open_roles = 4400;
      f.recent_market_momentum.weekly.at(-1).new_roles = 510;
    });

    const [roles] = await collectTrends(deps());

    expect(roles).toMatchObject({ status: "published", dataDate: "2026-11-10" });
    const [lastWeek] = await handle.db
      .select()
      .from(trendWeekly)
      .where(eq(trendWeekly.weekStart, "2026-11-02"));
    expect(lastWeek).toMatchObject({ newRoles: 510, asOfDate: "2026-11-10" });
  });
});

describe("collectTrends on later runs the same day (TRD-01, ADR 0006)", () => {
  it("replaces a date's figures with a newer file, keeping one snapshot", async () => {
    await collectTrends(deps());
    const [before] = await rolesSnapshots();
    served.roles = laterSameDay((f) => {
      f.totals.open_roles = 4400;
      f.recent_market_momentum.weekly.at(-1).new_roles = 510;
    });

    const [roles, pay] = await collectTrends(deps());

    expect(roles).toMatchObject({ kind: "roles", status: "updated", dataDate: "2026-11-09", snapshotId: before.id });
    expect(pay).toMatchObject({ kind: "pay", status: "skipped", reason: "this file is already stored" });
    expect(await rowCount(trendSnapshots)).toBe(2);
    expect(await rowCount(trendTotals)).toBe(1);
    expect(await rowCount(trendWorkTypes)).toBe(12);
    expect(await rowCount(trendPlatforms)).toBe(62);
    expect(await openRolesOn("2026-11-09")).toBe(4400);

    const [after] = await rolesSnapshots();
    expect(after).toMatchObject({ status: "published", holdReason: null });
    expect(after.sourceUpdatedAt).toEqual(new Date("2026-11-09T14:07:00Z"));
    expect(after.fetchedAt.getTime()).toBeGreaterThanOrEqual(before.fetchedAt.getTime());
    expect(after.rawKey).not.toBe(before.rawKey);
    // Every downloaded version is kept (TRD-01): two roles.json copies and one pay.json.
    expect(rawStore.files.size).toBe(3);

    // The shared weekly figure follows the newer file.
    const [lastWeek] = await handle.db.select().from(trendWeekly).where(eq(trendWeekly.weekStart, "2026-11-02"));
    expect(lastWeek).toMatchObject({ newRoles: 510, asOfDate: "2026-11-09" });
    expect(alerts).toEqual([]);
  });

  it("ignores a file for the date that is no newer than the stored one", async () => {
    await collectTrends(deps());
    const stored = await openRolesOn("2026-11-09");
    served.roles = rolesFor("2026-11-09", (f) => {
      f.updated = "2026-11-09T07:07:00+00:00";
      f.totals.open_roles = 1;
    });

    const [roles] = await collectTrends(deps());

    expect(roles).toMatchObject({ status: "skipped", reason: "the file stored for this date is as new or newer" });
    expect(await openRolesOn("2026-11-09")).toBe(stored);
  });

  it("TRD-02: keeps the published figures when a newer file for the date would be held", async () => {
    served = { roles: rolesFor("2026-11-08"), pay: payFor("2026-11-08") };
    await collectTrends(deps());
    served = { roles: readFixture(ROLES_FIXTURE), pay: readFixture(PAY_FIXTURE) };
    await collectTrends(deps());
    const stored = await openRolesOn("2026-11-09");
    served.roles = laterSameDay((f) => {
      f.totals.open_roles = 8000;
    });

    const [roles] = await collectTrends(deps());

    expect(roles).toMatchObject({ status: "skipped", dataDate: "2026-11-09" });
    expect(roles.status === "skipped" && roles.reason).toMatch(
      /^a newer file was held \(total open roles changed 83%.*\); the figures published earlier for this date stay$/,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/newer roles\.json for 2026-11-09 held, not published: total open roles changed 83%/);
    expect(await openRolesOn("2026-11-09")).toBe(stored);
    expect((await rolesSnapshots()).map((r) => r.status)).toEqual(["published", "published"]);
  });

  it("replaces held figures with a newer file that passes the checks", async () => {
    served = { roles: rolesFor("2026-11-08"), pay: payFor("2026-11-08") };
    await collectTrends(deps());
    served = {
      roles: rolesFor("2026-11-09", (f) => {
        f.totals.open_roles = 8000;
      }),
      pay: readFixture(PAY_FIXTURE),
    };
    const [held] = await collectTrends(deps());
    expect(held).toMatchObject({ status: "held", dataDate: "2026-11-09" });
    served.roles = laterSameDay((f) => {
      f.totals.open_roles = 4400;
    });

    const [roles] = await collectTrends(deps());

    expect(roles).toMatchObject({ status: "updated", dataDate: "2026-11-09", snapshotId: held.status === "held" ? held.snapshotId : -1 });
    const [, today] = await rolesSnapshots();
    expect(today).toMatchObject({ status: "published", holdReason: null });
    expect(await openRolesOn("2026-11-09")).toBe(4400);
  });
});

describe("lastCollectedAt (ADR 0006)", () => {
  it("is null before the first run, then the newest fetch time", async () => {
    expect(await lastCollectedAt(handle.db)).toBeNull();

    await collectTrends(deps());

    const fetched = (await handle.db.select({ at: trendSnapshots.fetchedAt }).from(trendSnapshots)).map((r) => r.at.getTime());
    expect(await lastCollectedAt(handle.db)).toEqual(new Date(Math.max(...fetched)));
  });
});
