import { and, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { contactConfig, visitConfig } from "../config";
import { clientAddress } from "../contact/address";
import type { Db } from "../db/client";
import { siteVisits } from "../db/schema";

/*
 * Records one page view in the visitor log (VIS-01, VIS-04, ADR 0008). Each page's VisitTracker
 * posts { path, referrer }; the server adds the time, the IP address, its approximate location and
 * the browser. Kept apart from the route so tests can call it.
 */

const visitSchema = z.object({
  path: z
    .string()
    .max(visitConfig.pathMaxChars)
    // A path on this site: one leading slash, no query or #hash, and not the admin pages or addresses.
    .regex(/^\/(?!\/)[^?#\s]*$/)
    .refine((path) => !/^\/(admin|api)(\/|$)/.test(path)),
  referrer: z.string().nullish(),
});

/** An http(s) address of another site, or null. Anything else (javascript:, junk, too long) is dropped. */
function cleanReferrer(referrer: string | null | undefined): string | null {
  if (!referrer || referrer.length > visitConfig.referrerMaxChars) return null;
  try {
    const url = new URL(referrer);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function header(headers: Headers, name: string, max: number, { urlEncoded = false } = {}): string | null {
  let value = headers.get(name)?.trim();
  if (!value) return null;
  if (urlEncoded) {
    try {
      value = decodeURIComponent(value);
    } catch {}
  }
  return value.slice(0, max);
}

export interface VisitDeps {
  db: Db;
  now?: Date;
}

const reply = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

export async function handleVisitRequest(request: Request, { db, now = new Date() }: VisitDeps): Promise<Response> {
  // Browsers say where a request comes from; only this site's own pages may report views.
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return reply(403);

  const text = await request.text();
  if (text.length > visitConfig.bodyMaxChars) return reply(413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400);
  }
  const parsed = visitSchema.safeParse(body);
  if (!parsed.success) return reply(400);

  const { headers } = request;
  const address = clientAddress(headers.get(contactConfig.address.header), contactConfig.address.trustedProxyHops);
  const ip = address === "unknown" ? null : address;
  const { country, region, city } = visitConfig.locationHeaders;

  try {
    const stored = await db.transaction(async (tx) => {
      // VIS-04: count and insert under a lock on this address, so a burst can't pass the limit.
      if (ip) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`visit:${ip}`}, 0))`);
        const minuteAgo = new Date(now.getTime() - 60_000);
        const [{ recent }] = await tx
          .select({ recent: count() })
          .from(siteVisits)
          .where(and(eq(siteVisits.ip, ip), gt(siteVisits.visitedAt, minuteAgo)));
        if (recent >= visitConfig.maxPerAddressPerMinute) return false;
      }
      await tx.insert(siteVisits).values({
        visitedAt: now,
        path: parsed.data.path,
        ip,
        country: header(headers, country, 8),
        region: header(headers, region, 16),
        city: header(headers, city, 100, { urlEncoded: true }),
        userAgent: header(headers, "user-agent", visitConfig.userAgentMaxChars),
        referrer: cleanReferrer(parsed.data.referrer),
      });
      return true;
    });
    return reply(stored ? 204 : 429);
  } catch (error) {
    console.error("[visits] Could not record a visit:", error);
    return reply(500);
  }
}
