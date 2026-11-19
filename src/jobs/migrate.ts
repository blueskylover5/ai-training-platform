/**
 * Applies database migrations. Run with `npm run db:migrate`.
 *
 * Vercel runs it before every build (vercel.json, ADR 0007), but it migrates only production builds:
 * preview builds of unmerged branches share the production database, and their migrations must
 * not reach it before review. Set MIGRATE_PREVIEWS=1 when previews have their own database.
 */
import { storageConfig } from "../config";
import { migrateDb, openDb } from "../db/client";

async function main() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (process.env.VERCEL && vercelEnv !== "production" && process.env.MIGRATE_PREVIEWS !== "1") {
    console.log(`Migrations skipped: a ${vercelEnv ?? "non-production"} build on Vercel (see src/jobs/migrate.ts).`);
    return;
  }
  const url = storageConfig.migrationDatabaseUrl;
  if (process.env.VERCEL && url.startsWith("pglite://")) {
    // Stop the deployment here rather than publish pages that cannot reach their data.
    throw new Error("DATABASE_URL is not set. Connect a Postgres database (Neon) to the Vercel project first (ADR 0007).");
  }
  const handle = openDb(url);
  try {
    await migrateDb(handle);
    console.log(`Migrations applied (${handle.driver}).`);
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
