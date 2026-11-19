import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/db/client";
import { siteVisits } from "../../src/db/schema";
import { visitConfig } from "../../src/config";
import { browserLabel, localTimestamp, recentVisits, visitsCsv, visitSummary, type SiteVisit } from "../../src/visits/report";
import { createTestDb } from "../helpers";

const JST = visitConfig.admin.timeZone;
const NOW = new Date("2026-11-19T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.execute(sql`TRUNCATE site_visits RESTART IDENTITY`);
});

async function seed() {
  await handle.db.insert(siteVisits).values([
    { visitedAt: hoursAgo(1), path: "/", ip: "203.0.113.7", country: "JP" },
    { visitedAt: hoursAgo(2), path: "/platforms", ip: "203.0.113.7", country: "JP" },
    { visitedAt: hoursAgo(30), path: "/", ip: "198.51.100.2", country: "US" },
    { visitedAt: hoursAgo(24 * 10), path: "/contact", ip: "198.51.100.3", country: "US" },
    { visitedAt: hoursAgo(24 * 40), path: "/", ip: "198.51.100.4", country: null },
  ]);
}

describe("visitor log: admin page (VIS-03, ADR 0008)", () => {
  it("sums up visits over time and the top pages and countries of the last 7 days", async () => {
    await seed();

    expect(await visitSummary(handle.db, NOW, 10)).toEqual({
      last24Hours: 2,
      last7Days: 3,
      last30Days: 4,
      allTime: 5,
      addresses7Days: 2,
      topPages: [
        { path: "/", visits: 2 },
        { path: "/platforms", visits: 1 },
      ],
      topCountries: [
        { country: "JP", visits: 2 },
        { country: "US", visits: 1 },
      ],
    });
  });

  it("lists the newest visits a page at a time", async () => {
    await seed();

    const first = await recentVisits(handle.db, 1, 2);
    const last = await recentVisits(handle.db, 3, 2);

    expect(first.visits.map((v) => v.path)).toEqual(["/", "/platforms"]);
    expect(first.hasOlder).toBe(true);
    expect(last.visits.map((v) => v.visitedAt)).toEqual([hoursAgo(24 * 40)]);
    expect(last.hasOlder).toBe(false);
  });

  it("names the browser briefly", () => {
    expect(
      browserLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"),
    ).toBe("Chrome 142 · Windows 10");
    expect(
      browserLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"),
    ).toBe("Mobile Safari 18 · iOS 18.1 · mobile");
    expect(browserLabel(null)).toBeNull();
  });
});

describe("visitor log: CSV download (VIS-03)", () => {
  const visit = (changes: Partial<SiteVisit>): SiteVisit => ({
    id: 1,
    visitedAt: new Date("2026-11-19T04:12:30Z"),
    path: "/",
    ip: "203.0.113.7",
    country: "JP",
    region: "13",
    city: "Minato City",
    userAgent: "Chrome",
    referrer: null,
    ...changes,
  });

  it("shows times in Japan time on the admin page, without daylight saving", () => {
    expect(JST).toEqual({ id: "Asia/Tokyo", label: "JST", name: "Japan time" });
    expect(localTimestamp(new Date("2026-11-19T04:12:30Z"), JST.id)).toBe("2026-11-19 13:12:30");
    // 9 hours ahead of UTC all year, so late evening UTC is already the next day in Japan.
    expect(localTimestamp(new Date("2026-12-31T15:00:00Z"), JST.id)).toBe("2027-01-01 00:00:00");
    expect(localTimestamp(new Date("2026-07-01T23:59:59Z"), JST.id)).toBe("2026-07-02 08:59:59");
  });

  it("writes one row per visit under a header, readable as UTF-8 by spreadsheets", () => {
    expect(visitsCsv([visit({ city: "São Paulo" })], JST)).toBe(
      "﻿visited_at_jst,visited_at_utc,path,ip,country,region,city,user_agent,referrer\r\n" +
        "2026-11-19 13:12:30,2026-11-19T04:12:30.000Z,/,203.0.113.7,JP,13,São Paulo,Chrome,\r\n",
    );
  });

  it("quotes commas, quotes and line breaks, and stops visitor text from running as a formula", () => {
    const csv = visitsCsv([
      visit({ userAgent: 'Bot, "v2"\nline', referrer: "=HYPERLINK(\"https://evil.example\")", path: "/-x" }),
      visit({ userAgent: "@SUM(A1)", referrer: "+1", city: "-2" }),
    ], JST);
    const [, first, second] = csv.split("\r\n");

    expect(first).toBe(
      '2026-11-19 13:12:30,2026-11-19T04:12:30.000Z,/-x,203.0.113.7,JP,13,Minato City,"Bot, ""v2""\nline","\'=HYPERLINK(""https://evil.example"")"',
    );
    expect(second).toBe("2026-11-19 13:12:30,2026-11-19T04:12:30.000Z,/,203.0.113.7,JP,13,'-2,'@SUM(A1),'+1");
  });
});
