/**
 * Daily trend collection (TRD-01, TRD-11). Run with `npm run trends:collect`.
 * Exits with code 1 when a file or the platform counts are rejected, so the scheduler reports a failure.
 */
import { storageConfig, trendsConfig } from "../config";
import { openDb } from "../db/client";
import { collectTrends } from "../trends/collect";
import { createFetchText } from "../trends/fetch";
import { collectPlatformStats } from "../trends/platform-stats";
import { FsRawStore } from "../trends/raw-store";

async function main() {
  const handle = openDb(storageConfig.databaseUrl);
  try {
    const fetchText = createFetchText({
      userAgent: trendsConfig.userAgent,
      timeoutMs: trendsConfig.fetchTimeoutMs,
      attempts: trendsConfig.fetchAttempts,
      retryDelayMs: trendsConfig.retryDelayMs,
    });
    const rawStore = new FsRawStore(storageConfig.rawStorageDir);
    // Alerts go to the job log for now; email or chat alerts come with the admin module.
    const alert = (message: string) => console.error(message);

    const outcomes = await collectTrends({ db: handle.db, fetchText, rawStore, alert });
    // Runs after roles.json, because it counts the platforms listed there.
    outcomes.push(await collectPlatformStats({ db: handle.db, fetchText, rawStore, alert }));

    for (const outcome of outcomes) console.log(JSON.stringify(outcome));
    if (outcomes.some((o) => o.status === "rejected")) process.exitCode = 1;
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
