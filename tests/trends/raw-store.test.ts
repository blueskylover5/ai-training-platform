import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/db/client";
import { trendRawFiles } from "../../src/db/schema";
import { DbRawStore } from "../../src/trends/raw-store";
import { createTestDb } from "../helpers";

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

describe("DbRawStore (TRD-01, ADR 0007)", () => {
  it("keeps raw copies in the database, once per key", async () => {
    const store = new DbRawStore(handle.db);
    const key = "aitraining-jobs/2026-11-19/roles-0123456789ab.json";

    await store.put(key, '{"total_open":5448}');
    // Keys name the content, so a second copy of the same key is the same file.
    await store.put(key, '{"total_open":5448}');
    await store.put("aitraining-jobs/2026-11-19/pay-ba9876543210.json", '{"pay":[]}');

    const rows = await handle.db.select().from(trendRawFiles).orderBy(trendRawFiles.key);
    expect(rows.map(({ key, body }) => ({ key, body }))).toEqual([
      { key: "aitraining-jobs/2026-11-19/pay-ba9876543210.json", body: '{"pay":[]}' },
      { key, body: '{"total_open":5448}' },
    ]);
    expect(rows[0].storedAt).toBeInstanceOf(Date);
  });
});
