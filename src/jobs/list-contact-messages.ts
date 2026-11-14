/**
 * Prints the newest contact-form messages (CON-03). Run with `npm run contact:list`.
 * With the local database (PGlite), stop the dev server first: only one process can open it.
 */
import { desc } from "drizzle-orm";
import { storageConfig } from "../config";
import { openDb } from "../db/client";
import { safeForTerminal } from "../contact/terminal";
import { contactMessages } from "../db/schema";

const LIMIT = 50;

async function main() {
  const handle = openDb(storageConfig.databaseUrl);
  try {
    const rows = await handle.db
      .select({
        id: contactMessages.id,
        createdAt: contactMessages.createdAt,
        name: contactMessages.name,
        email: contactMessages.email,
        topic: contactMessages.topic,
        message: contactMessages.message,
        status: contactMessages.status,
      })
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(LIMIT);
    if (rows.length === 0) {
      console.log("No contact messages yet.");
      return;
    }
    // Everything below came from the public form, so control characters are neutralised first.
    for (const row of rows) {
      console.log(`#${row.id} · ${row.createdAt.toISOString()} · ${row.status}`);
      // Only older messages have a topic: the form stopped asking for one (#7).
      const topic = row.topic ? ` · Topic: ${safeForTerminal(row.topic)}` : "";
      console.log(`From: ${safeForTerminal(row.name ?? "(no name)")} <${safeForTerminal(row.email)}>${topic}`);
      console.log(safeForTerminal(row.message));
      console.log("—".repeat(40));
    }
  } finally {
    await handle.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
