import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { trendsConfig } from "../../src/config";
import type { CollectOutcome } from "../../src/trends/collect";
import { bearerMatches, handleCollectRequest, type CollectEndpointDeps } from "../../src/trends/collect-endpoint";

const SECRET = "a-test-secret-of-32-characters!!";
const URL_ = `https://example.test${trendsConfig.endpoint.path}`;
const PUBLISHED: CollectOutcome = { kind: "roles", status: "published", dataDate: "2026-11-19", snapshotId: 1 };
const REJECTED: CollectOutcome = { kind: "pay", status: "rejected", reason: "GET pay.json answered HTTP 500" };

function call(authorization: string | null, deps: Partial<CollectEndpointDeps> = {}) {
  const headers = new Headers({ "user-agent": "vercel-cron/1.0" });
  if (authorization !== null) headers.set("authorization", authorization);
  const lines: string[] = [];
  const run = vi.fn(async () => [PUBLISHED]);
  const response = handleCollectRequest(new Request(URL_, { method: "POST", headers }), {
    secret: SECRET,
    secretMinChars: trendsConfig.endpoint.secretMinChars,
    run,
    log: (line) => lines.push(line),
    ...deps,
  });
  return { response, run: (deps.run as typeof run | undefined) ?? run, lines };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("collection address (TRD-01, ADR 0007)", () => {
  it("runs a collection for the right secret and lists what happened", async () => {
    const { response, run, lines } = call(`Bearer ${SECRET}`);

    const res = await response;

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ outcomes: [PUBLISHED] });
    expect(run).toHaveBeenCalledTimes(1);
    expect(lines).toEqual([
      "[trends] collecting (called by vercel-cron/1.0)",
      `[trends] ${JSON.stringify(PUBLISHED)}`,
    ]);
  });

  it.each([
    ["no header", null],
    ["a wrong secret", "Bearer not-the-secret"],
    ["the secret with more after it", `Bearer ${SECRET}x`],
    ["another scheme", `Basic ${SECRET}`],
    ["the secret alone", SECRET],
  ])("refuses %s without running anything", async (_case, authorization) => {
    const { response, run } = call(authorization);

    const res = await response;

    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined],
    ["too short", "short-secret"],
    ["blank", "   "],
  ])("is switched off while CRON_SECRET is %s", async (_case, secret) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    // Even a request that carries the same value is refused.
    const { response, run } = call(`Bearer ${secret ?? ""}`, { secret });

    const res = await response;

    expect(res.status).toBe(503);
    expect(run).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("CRON_SECRET is missing or shorter than 16 characters"));
  });

  it("answers 500 when a file was rejected, so the timer shows a failed run", async () => {
    const { response } = call(`Bearer ${SECRET}`, { run: vi.fn(async () => [PUBLISHED, REJECTED]) });

    const res = await response;

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ outcomes: [PUBLISHED, REJECTED] });
  });

  it("answers 500 without details when the run throws", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { response } = call(`Bearer ${SECRET}`, {
      run: vi.fn(async () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432"))),
    });

    const res = await response;

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("ECONNREFUSED");
    expect(errors).toHaveBeenCalledWith("[trends] collection failed:", expect.any(Error));
  });

  it("compares the whole header", () => {
    expect(bearerMatches(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(bearerMatches(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(bearerMatches(null, SECRET)).toBe(false);
    expect(bearerMatches("", SECRET)).toBe(false);
  });
});

describe("Vercel set-up (ADR 0007)", () => {
  const vercel = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
    buildCommand: string;
    schedules: Record<string, { schedule: string; path: string; requestMethod: string }>;
  };

  it("calls the collection address at the times in config.ts", () => {
    const { everyHours, minuteUtc } = trendsConfig.schedule;
    expect(vercel.schedules["collect-trends"]).toEqual({
      schedule: `${minuteUtc} */${everyHours} * * *`,
      path: trendsConfig.endpoint.path,
      requestMethod: "POST",
    });
    expect(existsSync(new URL(`../../src/app${trendsConfig.endpoint.path}/route.ts`, import.meta.url))).toBe(true);
  });

  it("migrates the database before building", () => {
    expect(vercel.buildCommand).toBe("npm run db:migrate && npm run build");
  });
});
