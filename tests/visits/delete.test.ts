import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { visitConfig } from "../../src/config";
import type { Db, DbHandle } from "../../src/db/client";
import { siteVisits } from "../../src/db/schema";
import type { AdminSettings } from "../../src/visits/admin-auth";
import { deleteVisits, deleteVisitsAsAdmin, parseDeleteSelection } from "../../src/visits/delete";
import { createTestDb } from "../helpers";

const SETTINGS: AdminSettings = { user: "admin", password: "correct horse battery", passwordMinChars: 12 };
const SIGNED_IN = `Basic ${Buffer.from("admin:correct horse battery").toString("base64")}`;

let handle: DbHandle;
const remaining = async () => (await handle.db.select({ id: siteVisits.id }).from(siteVisits).orderBy(siteVisits.id)).map((r) => r.id);

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.execute(sql`TRUNCATE site_visits RESTART IDENTITY`);
  await handle.db.insert(siteVisits).values([1, 2, 3, 4, 5].map((n) => ({ path: `/page-${n}`, ip: "203.0.113.7" })));
});

describe("visitor log: deleting visits (VIS-03)", () => {
  it("accepts a list of visits or every visit, and nothing else", () => {
    expect(parseDeleteSelection({ ids: [3, 1, 3] })).toEqual({ ids: [3, 1] });
    expect(parseDeleteSelection({ all: true })).toEqual({ all: true });
    for (const wrong of [
      null,
      {},
      { ids: [] },
      { ids: [0] },
      { ids: [-2] },
      { ids: [1.5] },
      { ids: ["1"] },
      { all: false },
      { all: true, ids: [1] },
      { ids: Array.from({ length: visitConfig.admin.maxDeleteIds + 1 }, (_, i) => i + 1) },
    ]) {
      expect(parseDeleteSelection(wrong), JSON.stringify(wrong).slice(0, 40)).toBeNull();
    }
  });

  it("deletes only the selected visits and counts them", async () => {
    expect(await deleteVisits(handle.db, { ids: [2, 4, 99] })).toBe(2);
    expect(await remaining()).toEqual([1, 3, 5]);
  });

  it("deletes every visit when all are selected", async () => {
    expect(await deleteVisits(handle.db, { all: true })).toBe(5);
    expect(await remaining()).toEqual([]);
  });

  it("deletes only for the signed-in admin, and logs what was deleted", async () => {
    const lines: string[] = [];
    const run = (authorization: string | null, input: unknown) =>
      deleteVisitsAsAdmin({ authorization, input, db: handle.db, settings: SETTINGS, log: (l) => lines.push(l) });

    expect(await run(null, { all: true })).toEqual({ ok: false, error: "Sign in as admin to delete visits." });
    expect(await run(`Basic ${Buffer.from("admin:wrong password!").toString("base64")}`, { ids: [1] })).toMatchObject({ ok: false });
    expect(await remaining()).toEqual([1, 2, 3, 4, 5]);

    expect(await run(SIGNED_IN, { ids: [] })).toEqual({ ok: false, error: "Select at least one visit to delete." });
    expect(await run(SIGNED_IN, { ids: [1, 5] })).toEqual({ ok: true, deleted: 2 });
    expect(await remaining()).toEqual([2, 3, 4]);
    expect(lines).toEqual(["[visits] admin deleted 2 visit(s): ids 1,5"]);
  });

  it("reports a database failure without throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      delete: () => {
        throw new Error("connection refused");
      },
    } as unknown as Db;

    const result = await deleteVisitsAsAdmin({ authorization: SIGNED_IN, input: { all: true }, db: broken, settings: SETTINGS });

    expect(result).toEqual({ ok: false, error: "The visits could not be deleted. Please try again." });
    expect(error).toHaveBeenCalledWith("[visits] Could not delete visits:", expect.any(Error));
    error.mockRestore();
  });
});
