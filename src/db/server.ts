import { storageConfig } from "../config";
import { openDb, type Db, type DbHandle } from "./client";

/**
 * One database handle per server process. Kept on globalThis so that
 * dev-server reloads reuse it instead of opening the database again.
 */
const holder = globalThis as typeof globalThis & { __trendsDb?: DbHandle };

export function getDb(): Db {
  holder.__trendsDb ??= openDb(storageConfig.databaseUrl);
  return holder.__trendsDb.db;
}
