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

  it("AT-01: running twice on the same date creates one snapshot", async () => {
    await collectTrends(deps());
    const second = await collectTrends(deps());

    expect(second.map((o) => o.status)).toEqual(["skipped", "skipped"]);
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
