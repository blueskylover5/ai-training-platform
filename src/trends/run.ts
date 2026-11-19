import { storageConfig, trendsConfig } from "../config";
import type { Db } from "../db/client";
import { collectTrends, type CollectOutcome } from "./collect";
import { createFetchText } from "./fetch";
import { collectPlatformStats } from "./platform-stats";
import { DbRawStore, FsRawStore } from "./raw-store";

/**
 * One collection run (TRD-01, TRD-11): roles.json and pay.json, then the per-platform counts,
 * which need the roles file. Used by `npm run trends:collect`, the app's schedule (ADR 0006) and
 * the collection address that Vercel's schedule calls (ADR 0007).
 */
export async function runCollection(db: Db): Promise<CollectOutcome[]> {
  const fetchText = createFetchText({
    userAgent: trendsConfig.userAgent,
    timeoutMs: trendsConfig.fetchTimeoutMs,
    attempts: trendsConfig.fetchAttempts,
    retryDelayMs: trendsConfig.retryDelayMs,
  });
  const rawStore = storageConfig.rawStorage === "database" ? new DbRawStore(db) : new FsRawStore(storageConfig.rawStorageDir);
  // Alerts go to the server log for now; email or chat alerts come with the admin module.
  const alert = (message: string) => console.error(message);

  const outcomes = await collectTrends({ db, fetchText, rawStore, alert });
  // Runs after roles.json, because it counts the platforms listed there.
  outcomes.push(await collectPlatformStats({ db, fetchText, rawStore, alert }));
  return outcomes;
}
