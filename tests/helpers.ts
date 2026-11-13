import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { migrateDb, openDb, type DbHandle } from "../src/db/client";

/** A migrated in-memory database (ADR 0002). Starting one takes a few seconds, so share it per test file. */
export async function createTestDb(): Promise<DbHandle> {
  const handle = openDb("pglite://memory");
  await migrateDb(handle);
  return handle;
}

/** Empties every trends table so each test starts clean. */
export async function resetTrendTables(handle: DbHandle): Promise<void> {
  await handle.db.execute(
    sql`TRUNCATE trend_weekly, trend_pay, trend_platforms, trend_work_types, trend_totals, trend_snapshots RESTART IDENTITY CASCADE`,
  );
}

export function readFixture(name: string): string {
  return readFileSync(new URL(`./fixtures/aitraining-jobs/${name}`, import.meta.url), "utf8");
}

export const ROLES_FIXTURE = "roles-2026-11-09.json";
export const PAY_FIXTURE = "pay-2026-11-09.json";
