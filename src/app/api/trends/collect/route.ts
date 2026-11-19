import { connection } from "next/server";
import { trendsConfig } from "@/config";
import { getDb } from "@/db/server";
import { handleCollectRequest } from "@/trends/collect-endpoint";
import { runCollection } from "@/trends/run";

/**
 * Runs one trends collection when a timer calls it (TRD-01, ADR 0007). On Vercel, the schedule in
 * vercel.json calls it every 6 hours with "Authorization: Bearer <CRON_SECRET>".
 *
 * A run takes 2 to 3 minutes, mostly the paced platform searches (TRD-11). 300 seconds is the
 * longest Vercel's free plan allows. The build reads this value, so it has to be written out here.
 */
export const maxDuration = 300;

async function collect(request: Request): Promise<Response> {
  // Never prerendered: every call runs at request time.
  await connection();
  return handleCollectRequest(request, {
    secret: process.env.CRON_SECRET,
    secretMinChars: trendsConfig.endpoint.secretMinChars,
    run: () => runCollection(getDb()),
  });
}

// Vercel Schedules send POST; GET suits timers that can only send GET.
export { collect as GET, collect as POST };
