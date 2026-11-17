import { storageConfig, trendsConfig } from "../config";
import type { Db } from "../db/client";
import { collectTrends, type CollectOutcome } from "./collect";
import { createFetchText } from "./fetch";
import { collectPlatformStats } from "./platform-stats";
import { FsRawStore } from "./raw-store";

/**
 * One collection run (TRD-01, TRD-11): roles.json and pay.json, then the per-platform counts,
 * which need the roles file. Used by `npm run trends:collect` and by the app's schedule (ADR 0006).
 */
export async function runCollection(db: Db): Promise<CollectOutcome[]> {
  const fetchText = createFetchText({
    userAgent: trendsConfig.userAgent,
    timeoutMs: trendsConfig.fetchTimeoutMs,
    attempts: trendsConfig.fetchAttempts,
    retryDelayMs: trendsConfig.retryDelayMs,
  });
  const rawStore = new FsRawStore(storageConfig.rawStorageDir);
  // Alerts go to the server log for now; email or chat alerts come with the admin module.
  const alert = (message: string) => console.error(message);

  const outcomes = await collectTrends({ db, fetchText, rawStore, alert });
  // Runs after roles.json, because it counts the platforms listed there.
  outcomes.push(await collectPlatformStats({ db, fetchText, rawStore, alert }));
  return outcomes;
}
