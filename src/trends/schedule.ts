import { max } from "drizzle-orm";
import { trendsConfig } from "../config";
import type { Db } from "../db/client";
import { trendSnapshots } from "../db/schema";
import type { CollectOutcome } from "./collect";

/**
 * TRD-01 (ADR 0006): runs the trend collection every few hours at fixed UTC times, inside the app
 * server. A server that starts after missing a run catches up shortly after starting.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface ScheduleSettings {
  /** Hours between runs, counted from midnight UTC each day. */
  everyHours: number;
  /** Minutes past the hour. */
  minuteUtc: number;
  /** Pause before catching up on a missed run after the server starts. */
  catchUpDelayMs: number;
}

/** The run times of the UTC day that starts at `dayStart`, as milliseconds. */
function runTimesOf(dayStart: number, settings: Pick<ScheduleSettings, "everyHours" | "minuteUtc">): number[] {
  const times: number[] = [];
  for (let hour = 0; hour < 24; hour += settings.everyHours) times.push(dayStart + hour * HOUR_MS + settings.minuteUtc * 60_000);
  return times;
}

function utcDayStart(at: Date): number {
  return Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
}

/** The first run time after `now`. With 6 hours and 30 minutes: 13:00 UTC → 18:30 UTC. */
export function nextRunAt(now: Date, settings: Pick<ScheduleSettings, "everyHours" | "minuteUtc">): Date {
  const today = utcDayStart(now);
  const times = [...runTimesOf(today, settings), ...runTimesOf(today + DAY_MS, settings)];
  return new Date(Math.min(...times.filter((t) => t > now.getTime())));
}

/** The last run time at or before `now`. With 6 hours and 30 minutes: 13:00 UTC → 12:30 UTC. */
export function previousRunAt(now: Date, settings: Pick<ScheduleSettings, "everyHours" | "minuteUtc">): Date {
  const today = utcDayStart(now);
  const times = [...runTimesOf(today - DAY_MS, settings), ...runTimesOf(today, settings)];
  return new Date(Math.max(...times.filter((t) => t <= now.getTime())));
}

/** True when nothing has been collected since the last run time, so a run was missed. */
export function missedRun(lastRunAt: Date | null, now: Date, settings: Pick<ScheduleSettings, "everyHours" | "minuteUtc">): boolean {
  return lastRunAt === null || lastRunAt.getTime() < previousRunAt(now, settings).getTime();
}

/** When the collection last stored or refreshed anything, or null before the first run. */
export async function lastCollectedAt(db: Db): Promise<Date | null> {
  const [row] = await db.select({ at: max(trendSnapshots.fetchedAt) }).from(trendSnapshots);
  return row?.at ?? null;
}

export interface ScheduleDeps {
  /** One collection run. */
  run: () => Promise<CollectOutcome[]>;
  /** When the collection last stored anything (see lastCollectedAt). */
  lastRunAt: () => Promise<Date | null>;
  settings?: ScheduleSettings;
  log?: (line: string) => void;
}

export interface TrendsSchedule {
  stop: () => void;
}

/**
 * Starts the schedule and returns at once: the first run waits for its time, or for the catch-up
 * delay when a run was missed. Runs never overlap, because the next one is only planned when the
 * current one ends. A failed run is logged and the schedule carries on.
 */
export function startTrendsSchedule(deps: ScheduleDeps): TrendsSchedule {
  const settings = deps.settings ?? trendsConfig.schedule;
  const log = deps.log ?? ((line: string) => console.log(line));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const after = (ms: number, task: () => Promise<void>) => {
    if (stopped) return;
    timer = setTimeout(() => void task(), Math.max(0, ms));
    // A pending run never keeps a process alive on its own.
    timer.unref?.();
  };
  const planNext = () => {
    const now = new Date();
    const at = nextRunAt(now, settings);
    log(`[trends] next collection at ${at.toISOString()}`);
    after(at.getTime() - now.getTime(), runNow);
  };
  const runNow = async () => {
    if (stopped) return;
    log("[trends] collecting");
    try {
      for (const outcome of await deps.run()) log(`[trends] ${JSON.stringify(outcome)}`);
    } catch (error) {
      console.error("[trends] collection failed:", error);
    }
    planNext();
  };

  void (async () => {
    let missed = false;
    try {
      missed = missedRun(await deps.lastRunAt(), new Date(), settings);
    } catch (error) {
      console.error("[trends] could not read when the last collection ran:", error);
    }
    if (missed) {
      log(`[trends] a scheduled collection was missed; collecting in ${Math.round(settings.catchUpDelayMs / 1000)} s`);
      after(settings.catchUpDelayMs, runNow);
    } else {
      planNext();
    }
  })();

  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
