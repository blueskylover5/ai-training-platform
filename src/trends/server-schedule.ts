import { getDb } from "../db/server";
import { runCollection } from "./run";
import { lastCollectedAt, startTrendsSchedule, type TrendsSchedule } from "./schedule";

/**
 * Starts the trend schedule in this server process, once (ADR 0006). It uses the same database
 * handle as the pages, which a local PGlite database requires: only one handle may open it.
 */
const holder = globalThis as typeof globalThis & { __trendsSchedule?: TrendsSchedule };

export function startServerTrendsSchedule(): void {
  holder.__trendsSchedule ??= startTrendsSchedule({
    run: () => runCollection(getDb()),
    lastRunAt: () => lastCollectedAt(getDb()),
  });
}
