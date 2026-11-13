/** Applies database migrations. Run with `npm run db:migrate`. */
import { storageConfig } from "../config";
import { migrateDb, openDb } from "../db/client";

async function main() {
  const handle = openDb(storageConfig.databaseUrl);
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
