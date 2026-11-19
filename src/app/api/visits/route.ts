import { getDb } from "@/db/server";
import { handleVisitRequest } from "@/visits/record";

/** Each page reports its view here (VIS-01, ADR 0008). POST only, so it is never prerendered. */
export async function POST(request: Request): Promise<Response> {
  return handleVisitRequest(request, { db: getDb() });
}
