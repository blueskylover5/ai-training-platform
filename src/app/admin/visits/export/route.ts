import { visitConfig } from "@/config";
import { getDb } from "@/db/server";
import { adminAccess, adminSettings } from "@/visits/admin-auth";
import { allVisits, localTimestamp, visitsCsv } from "@/visits/report";

/** Every visit in the visitor log as a CSV file (VIS-03, ADR 0008). Behind the admin password. */
export async function GET(request: Request): Promise<Response> {
  // proxy.ts asks for the password first; checked again here in case it ever stops matching.
  if (adminAccess(request.headers.get("authorization"), adminSettings()) !== "allowed") {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const { timeZone } = visitConfig.admin;
  const csv = visitsCsv(await allVisits(getDb()), timeZone);
  // The file is named after today's date in the admin page's time zone (Japan).
  const date = localTimestamp(new Date(), timeZone.id).slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="visits-${date}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
