import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CollectOutcome } from "../../src/trends/collect";
import {
  missedRun,
  nextRunAt,
  previousRunAt,
  startTrendsSchedule,
  type ScheduleDeps,
  type TrendsSchedule,
} from "../../src/trends/schedule";

const HOUR = 60 * 60 * 1000;
const SIX = { everyHours: 6, minuteUtc: 30 };
const SETTINGS = { ...SIX, catchUpDelayMs: 30_000 };
const OUTCOME: CollectOutcome = { kind: "roles", status: "updated", dataDate: "2026-11-18", snapshotId: 1 };

describe("run times (TRD-01, ADR 0006)", () => {
  it("runs at 00:30, 06:30, 12:30 and 18:30 UTC", () => {
    expect(nextRunAt(new Date("2026-11-18T00:00:00Z"), SIX)).toEqual(new Date("2026-11-18T00:30:00Z"));
    expect(nextRunAt(new Date("2026-11-18T13:00:00Z"), SIX)).toEqual(new Date("2026-11-18T18:30:00Z"));
    // Strictly after: a run that ends at its own start time waits for the next one.
    expect(nextRunAt(new Date("2026-11-18T18:30:00Z"), SIX)).toEqual(new Date("2026-11-19T00:30:00Z"));
    expect(nextRunAt(new Date("2026-11-30T23:59:00Z"), SIX)).toEqual(new Date("2026-12-01T00:30:00Z"));
  });

  it("finds the last run time, including yesterday's", () => {
    expect(previousRunAt(new Date("2026-11-18T13:00:00Z"), SIX)).toEqual(new Date("2026-11-18T12:30:00Z"));
    expect(previousRunAt(new Date("2026-11-18T12:30:00Z"), SIX)).toEqual(new Date("2026-11-18T12:30:00Z"));
    expect(previousRunAt(new Date("2026-11-18T00:10:00Z"), SIX)).toEqual(new Date("2026-11-17T18:30:00Z"));
  });

  it("starts each day again at midnight when the gap does not divide the day", () => {
    // 00:30, 05:30, 10:30, 15:30 and 20:30: four and a half hours from the last run of a day to the next day's first.
    const five = { everyHours: 5, minuteUtc: 30 };
    expect(previousRunAt(new Date("2026-11-18T00:10:00Z"), five)).toEqual(new Date("2026-11-17T20:30:00Z"));
    expect(nextRunAt(new Date("2026-11-18T21:00:00Z"), five)).toEqual(new Date("2026-11-19T00:30:00Z"));
  });

  it("spots a missed run", () => {
    const now = new Date("2026-11-18T13:00:00Z");
    expect(missedRun(null, now, SIX)).toBe(true);
    expect(missedRun(new Date("2026-11-18T12:31:10Z"), now, SIX)).toBe(false);
    expect(missedRun(new Date("2026-11-18T06:33:00Z"), now, SIX)).toBe(true);
  });
});

describe("startTrendsSchedule (ADR 0006)", () => {
  let schedule: TrendsSchedule | undefined;
  let lines: string[];

  function start(deps: Partial<ScheduleDeps>) {
    schedule = startTrendsSchedule({
      run: async () => [OUTCOME],
      lastRunAt: async () => new Date("2026-11-18T12:31:00Z"),
      settings: SETTINGS,
      log: (line) => lines.push(line),
      ...deps,
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T13:00:00Z"));
    lines = [];
  });

  afterEach(() => {
    schedule?.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for the next run time when nothing was missed, then runs every 6 hours", async () => {
    const run = vi.fn(async () => [OUTCOME]);
    start({ run });

    await vi.advanceTimersByTimeAsync(5.5 * HOUR - 1); // 18:29:59.999
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); // 18:30
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6 * HOUR); // 00:30 the next day
    expect(run).toHaveBeenCalledTimes(2);
    expect(lines).toContain(`[trends] ${JSON.stringify(OUTCOME)}`);
    expect(lines).toContain("[trends] next collection at 2026-11-19T06:30:00.000Z");
  });

  it("catches up shortly after starting when a run was missed", async () => {
    const run = vi.fn(async () => [OUTCOME]);
    start({ run, lastRunAt: async () => new Date("2026-11-13T01:37:00Z") });

    await vi.advanceTimersByTimeAsync(29_999);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(lines[0]).toBe("[trends] a scheduled collection was missed; collecting in 30 s");
    // Then back on the clock: 18:30.
    await vi.advanceTimersByTimeAsync(5.5 * HOUR - 30_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("catches up before the first run ever", async () => {
    const run = vi.fn(async () => [OUTCOME]);
    start({ run, lastRunAt: async () => null });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("carries on after a failed run", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValueOnce(new Error("network down")).mockResolvedValue([OUTCOME]);
    start({ run });

    await vi.advanceTimersByTimeAsync(5.5 * HOUR); // 18:30: fails
    expect(errors).toHaveBeenCalledWith("[trends] collection failed:", expect.any(Error));
    await vi.advanceTimersByTimeAsync(6 * HOUR); // 00:30: runs again
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never starts a run while one is still going", async () => {
    // A run that takes 7 hours, past the 00:30 run time.
    const run = vi.fn(() => new Promise<CollectOutcome[]>((resolve) => setTimeout(() => resolve([OUTCOME]), 7 * HOUR)));
    start({ run });

    await vi.advanceTimersByTimeAsync(5.5 * HOUR); // 18:30: starts
    await vi.advanceTimersByTimeAsync(7 * HOUR); // 01:30: ends; 00:30 has passed
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5 * HOUR); // 06:30
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps to the clock when the last run time cannot be read", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn(async () => [OUTCOME]);
    start({ run, lastRunAt: async () => Promise.reject(new Error("relation does not exist")) });

    await vi.advanceTimersByTimeAsync(5.5 * HOUR);
    expect(errors).toHaveBeenCalledWith("[trends] could not read when the last collection ran:", expect.any(Error));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("stops", async () => {
    const run = vi.fn(async () => [OUTCOME]);
    start({ run });
    await vi.advanceTimersByTimeAsync(0);

    schedule?.stop();
    await vi.advanceTimersByTimeAsync(24 * HOUR);

    expect(run).not.toHaveBeenCalled();
  });
});
