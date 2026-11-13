import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Schema = typeof schema;

/** Driver-independent database type used by application code. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export type DbHandle =
  | { driver: "pglite"; db: Db; native: PgliteDatabase<Schema>; close: () => Promise<void> }
  | { driver: "postgres"; db: Db; native: PostgresJsDatabase<Schema>; close: () => Promise<void> };

const PGLITE_PREFIX = "pglite://";

/**
 * Opens a database from a URL (ADR 0002):
 * "pglite://memory" for an in-memory database, "pglite://<directory>" for one on disk,
 * or a postgres:// connection string.
 */
export function openDb(url: string): DbHandle {
  if (url.startsWith(PGLITE_PREFIX)) {
    const target = url.slice(PGLITE_PREFIX.length);
    const inMemory = target === "" || target === "memory";
    // PGlite creates its own directory but not missing parents.
    if (!inMemory) mkdirSync(target, { recursive: true });
    const client = inMemory ? new PGlite() : new PGlite(target);
    const native = drizzlePglite(client, { schema });
    return { driver: "pglite", db: native as unknown as Db, native, close: () => client.close() };
  }
  const client = postgres(url, { max: 5 });
  const native = drizzlePostgres(client, { schema });
  return { driver: "postgres", db: native as unknown as Db, native, close: () => client.end() };
}

/** Applies the SQL migrations in ./drizzle. */
export async function migrateDb(handle: DbHandle, migrationsFolder = "drizzle"): Promise<void> {
  if (handle.driver === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.native, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(handle.native, { migrationsFolder });
  }
}
