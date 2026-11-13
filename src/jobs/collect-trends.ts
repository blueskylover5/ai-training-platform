/**
 * Daily trend collection (TRD-01). Run with `npm run trends:collect`.
 * Exits with code 1 when a file is rejected, so the scheduler reports a failure.
 */
import { storageConfig, trendsConfig } from "../config";
import { openDb } from "../db/client";
import { collectTrends } from "../trends/collect";
import { createFetchText } from "../trends/fetch";
import { FsRawStore } from "../trends/raw-store";

async function main() {
  const handle = openDb(storageConfig.databaseUrl);
  try {
    const outcomes = await collectTrends({
      db: handle.db,
      fetchText: createFetchText({
        userAgent: trendsConfig.userAgent,
        timeoutMs: trendsConfig.fetchTimeoutMs,
        attempts: trendsConfig.fetchAttempts,
        retryDelayMs: trendsConfig.retryDelayMs,
      }),
      rawStore: new FsRawStore(storageConfig.rawStorageDir),
      // Alerts go to the job log for now; email or chat alerts come with the admin module.
      alert: (message) => console.error(message),
    });
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
