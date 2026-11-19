import { storageConfig } from "../config";
import { openDb, type Db, type DbHandle } from "./client";

/**
 * One database handle per server process. Kept on globalThis so that
 * dev-server reloads reuse it instead of opening the database again.
 */
const holder = globalThis as typeof globalThis & { __trendsDb?: DbHandle };

export function getDb(): Db {
  if (!holder.__trendsDb) {
    const url = storageConfig.databaseUrl;
    // Vercel functions have no lasting disk, so a local PGlite database would lose everything (ADR 0007).
    if (process.env.VERCEL && url.startsWith("pglite://")) {
      throw new Error("DATABASE_URL must be a postgres:// connection string on Vercel (ADR 0007).");
    }
    holder.__trendsDb = openDb(url);
  }
  return holder.__trendsDb.db;
}
