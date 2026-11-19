import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { visitConfig } from "../../src/config";
import type { Db, DbHandle } from "../../src/db/client";
import { siteVisits } from "../../src/db/schema";
import { handleVisitRequest } from "../../src/visits/record";
import { createTestDb } from "../helpers";

const NOW = new Date("2026-11-19T04:12:30Z");
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";

/** A page view as the browser and Vercel send it. */
function view(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://example.test${visitConfig.endpointPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "sec-fetch-site": "same-origin",
      "user-agent": CHROME,
      // Vercel's proxy appends the address it saw; a visitor-typed entry sits further left (CON-04).
      "x-forwarded-for": "10.9.9.9, 203.0.113.7",
      "x-vercel-ip-country": "JP",
      "x-vercel-ip-country-region": "13",
      "x-vercel-ip-city": "Minato%20City",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let handle: DbHandle;
const record = (request: Request, now = NOW) => handleVisitRequest(request, { db: handle.db, now });
const stored = () => handle.db.select().from(siteVisits).orderBy(siteVisits.id);

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.execute(sql`TRUNCATE site_visits RESTART IDENTITY`);
});

describe("visitor log: recording (VIS-01, ADR 0008)", () => {
  it("records the page, time, IP address, location, browser and the site the visit came from", async () => {
    const res = await record(view({ path: "/platforms", referrer: "https://www.google.com/" }));

    expect(res.status).toBe(204);
    expect(await stored()).toEqual([
      {
        id: 1,
        visitedAt: NOW,
        path: "/platforms",
        ip: "203.0.113.7",
        country: "JP",
        region: "13",
        city: "Minato City",
        userAgent: CHROME,
        referrer: "https://www.google.com/",
      },
    ]);
  });

  it("leaves out what it doesn't know", async () => {
    const res = await record(
      new Request(`https://example.test${visitConfig.endpointPath}`, { method: "POST", body: JSON.stringify({ path: "/" }) }),
    );

    expect(res.status).toBe(204);
    expect(await stored()).toMatchObject([{ path: "/", ip: null, country: null, region: null, city: null, userAgent: null, referrer: null }]);
  });

  it("drops a referrer that isn't a web address", async () => {
    await record(view({ path: "/", referrer: "javascript:alert(1)" }));
    await record(view({ path: "/", referrer: "not a url" }));
    await record(view({ path: "/", referrer: `https://example.com/${"x".repeat(visitConfig.referrerMaxChars)}` }));

    expect((await stored()).map((v) => v.referrer)).toEqual([null, null, null]);
  });

  it("cuts a very long browser name to size", async () => {
    await record(view({ path: "/" }, { "user-agent": "x".repeat(2_000) }));

    const [visit] = await stored();
    expect(visit.userAgent).toHaveLength(visitConfig.userAgentMaxChars);
  });

  it.each([
    ["no path", {}],
    ["a path without a leading slash", { path: "platforms" }],
    ["another site", { path: "//evil.example/x" }],
    ["a query", { path: "/platforms?x=1" }],
    ["an admin page", { path: "/admin/visits" }],
    ["an address", { path: "/api/visits" }],
    ["a path that is too long", { path: `/${"a".repeat(visitConfig.pathMaxChars)}` }],
  ])("refuses %s", async (_case, body) => {
    expect((await record(view(body))).status).toBe(400);
    expect(await stored()).toEqual([]);
  });

  it("refuses broken or oversized bodies", async () => {
    expect((await record(view("{not json"))).status).toBe(400);
    expect((await record(view(`{"path":"/","pad":"${"x".repeat(visitConfig.bodyMaxChars)}"}`))).status).toBe(413);
    expect(await stored()).toEqual([]);
  });

  it("refuses reports sent from other sites' pages", async () => {
    expect((await record(view({ path: "/" }, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(await stored()).toEqual([]);
  });

  it("keeps to the per-minute limit for one address, and lets it through again a minute later (VIS-04)", async () => {
    const limit = visitConfig.maxPerAddressPerMinute;
    const burst = await Promise.all(Array.from({ length: limit + 5 }, () => record(view({ path: "/" }))));

    expect(burst.filter((r) => r.status === 204)).toHaveLength(limit);
    expect(burst.filter((r) => r.status === 429)).toHaveLength(5);
    // Another address is not affected.
    expect((await record(view({ path: "/" }, { "x-forwarded-for": "198.51.100.2" }))).status).toBe(204);
    // A minute later.
    expect((await record(view({ path: "/" }), new Date(NOW.getTime() + 61_000))).status).toBe(204);
    expect(await stored()).toHaveLength(limit + 2);
  });

  it("answers 500 when the database fails, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = { transaction: async () => Promise.reject(new Error("connection refused")) } as unknown as Db;

    expect((await handleVisitRequest(view({ path: "/" }), { db: broken, now: NOW })).status).toBe(500);
    expect(error).toHaveBeenCalledWith("[visits] Could not record a visit:", expect.any(Error));
    error.mockRestore();
  });

  it("has its address where pages send their reports", () => {
    expect(existsSync(new URL(`../../src/app${visitConfig.endpointPath}/route.ts`, import.meta.url))).toBe(true);
  });
});
