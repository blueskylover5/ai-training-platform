"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getDb } from "@/db/server";
import { adminSettings } from "@/visits/admin-auth";
import { deleteVisitsAsAdmin, type DeleteResult } from "@/visits/delete";

/**
 * Deletes the selected visits (VIS-03). proxy.ts asks for the admin password before this runs;
 * deleteVisitsAsAdmin checks it again, because Server Actions can be called directly.
 */
export async function deleteVisitsAction(input: unknown): Promise<DeleteResult> {
  const requestHeaders = await headers();
  const result = await deleteVisitsAsAdmin({
    authorization: requestHeaders.get("authorization"),
    input,
    db: getDb(),
    settings: adminSettings(),
  });
  // Show the page again with the visits gone and the totals updated.
  if (result.ok) refresh();
  return result;
}
