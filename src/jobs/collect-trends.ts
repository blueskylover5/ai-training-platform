/**
 * One trend collection run (TRD-01, TRD-11), for a cron job or by hand: `npm run trends:collect`.
 * The app server runs the same collection every few hours by itself (ADR 0006); with a local
 * PGlite database, stop the app first, because only one process can open it.
 * Exits with code 1 when a file or the platform counts are rejected, so the scheduler reports a failure.
 */
import { storageConfig } from "../config";
import { openDb } from "../db/client";
import { runCollection } from "../trends/run";

async function main() {
  const handle = openDb(storageConfig.databaseUrl);
  try {
    const outcomes = await runCollection(handle.db);
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
