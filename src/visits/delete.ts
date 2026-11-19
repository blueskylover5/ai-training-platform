import { inArray } from "drizzle-orm";
import { z } from "zod";
import { visitConfig } from "../config";
import type { Db } from "../db/client";
import { siteVisits } from "../db/schema";
import { adminAccess, type AdminSettings } from "./admin-auth";

/*
 * Deleting visits from the visitor log (VIS-03, ADR 0008): the owner selects visits on
 * /admin/visits, one by one, a range, a page or all of them, and deletes them. Kept apart from the
 * Server Action so tests can call it.
 */

/** Which visits to delete: the ones listed, or every visit in the log. */
export type DeleteSelection = { ids: number[] } | { all: true };

export type DeleteResult = { ok: true; deleted: number } | { ok: false; error: string };

const selectionSchema = z.union([
  z.object({ all: z.literal(true) }).strict(),
  z
    .object({
      ids: z.array(z.number().int().positive()).min(1).max(visitConfig.admin.maxDeleteIds),
    })
    .strict(),
]);

/** The selection sent by the page, or null when it isn't one we accept. */
export function parseDeleteSelection(input: unknown): DeleteSelection | null {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return null;
  return "all" in parsed.data ? { all: true } : { ids: [...new Set(parsed.data.ids)] };
}

/** Deletes the selected visits and says how many were deleted (ids that no longer exist count as none). */
export async function deleteVisits(db: Db, selection: DeleteSelection): Promise<number> {
  const deleted =
    "all" in selection
      ? await db.delete(siteVisits).returning({ id: siteVisits.id })
      : await db.delete(siteVisits).where(inArray(siteVisits.id, selection.ids)).returning({ id: siteVisits.id });
  return deleted.length;
}

export interface DeleteAsAdminDeps {
  /** The request's Authorization header. */
  authorization: string | null;
  /** What the page sent. */
  input: unknown;
  db: Db;
  settings: AdminSettings;
  log?: (line: string) => void;
}

/**
 * Checks the admin password again (a Server Action can be called directly, not only from the page),
 * then deletes. Each deletion is written to the server log until the admin module's audit log
 * exists (SEC-07).
 */
export async function deleteVisitsAsAdmin({ authorization, input, db, settings, log = console.log }: DeleteAsAdminDeps): Promise<DeleteResult> {
  if (adminAccess(authorization, settings) !== "allowed") {
    return { ok: false, error: "Sign in as admin to delete visits." };
  }
  const selection = parseDeleteSelection(input);
  if (!selection) return { ok: false, error: "Select at least one visit to delete." };
  try {
    const deleted = await deleteVisits(db, selection);
    log(`[visits] admin deleted ${deleted} visit(s): ${"all" in selection ? "all visits" : `ids ${selection.ids.join(",")}`}`);
    return { ok: true, deleted };
  } catch (error) {
    console.error("[visits] Could not delete visits:", error);
    return { ok: false, error: "The visits could not be deleted. Please try again." };
  }
}
