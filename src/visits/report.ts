import { desc, gt, sql } from "drizzle-orm";
import { userAgent } from "next/server";
import type { Db } from "../db/client";
import { siteVisits } from "../db/schema";

/* What the admin page and the CSV download show from the visitor log (VIS-03, ADR 0008). */

export type SiteVisit = typeof siteVisits.$inferSelect;

export interface VisitSummary {
  last24Hours: number;
  last7Days: number;
  last30Days: number;
  allTime: number;
  /** Different IP addresses in the last 7 days. */
  addresses7Days: number;
  topPages: Array<{ path: string; visits: number }>;
  topCountries: Array<{ country: string | null; visits: number }>;
}

const HOUR_MS = 60 * 60 * 1000;
const since = (now: Date, hours: number) => sql`${new Date(now.getTime() - hours * HOUR_MS).toISOString()}::timestamptz`;

export async function visitSummary(db: Db, now: Date, topCount: number): Promise<VisitSummary> {
  const week = new Date(now.getTime() - 7 * 24 * HOUR_MS);
  const [totals] = await db
    .select({
      last24Hours: sql<number>`count(*) filter (where ${siteVisits.visitedAt} > ${since(now, 24)})`.mapWith(Number),
      last7Days: sql<number>`count(*) filter (where ${siteVisits.visitedAt} > ${since(now, 7 * 24)})`.mapWith(Number),
      last30Days: sql<number>`count(*) filter (where ${siteVisits.visitedAt} > ${since(now, 30 * 24)})`.mapWith(Number),
      allTime: sql<number>`count(*)`.mapWith(Number),
      addresses7Days: sql<number>`count(distinct ${siteVisits.ip}) filter (where ${siteVisits.visitedAt} > ${since(now, 7 * 24)})`.mapWith(Number),
    })
    .from(siteVisits);
  const visits = sql<number>`count(*)`.mapWith(Number);
  const [topPages, topCountries] = await Promise.all([
    db
      .select({ path: siteVisits.path, visits })
      .from(siteVisits)
      .where(gt(siteVisits.visitedAt, week))
      .groupBy(siteVisits.path)
      .orderBy(desc(visits), siteVisits.path)
      .limit(topCount),
    db
      .select({ country: siteVisits.country, visits })
      .from(siteVisits)
      .where(gt(siteVisits.visitedAt, week))
      .groupBy(siteVisits.country)
      .orderBy(desc(visits), siteVisits.country)
      .limit(topCount),
  ]);
  return { ...totals, topPages, topCountries };
}

/** One page of the newest visits; page 1 is the newest. */
export async function recentVisits(db: Db, page: number, pageSize: number): Promise<{ visits: SiteVisit[]; hasOlder: boolean }> {
  const rows = await db
    .select()
    .from(siteVisits)
    .orderBy(desc(siteVisits.visitedAt), desc(siteVisits.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return { visits: rows.slice(0, pageSize), hasOlder: rows.length > pageSize };
}

export async function allVisits(db: Db): Promise<SiteVisit[]> {
  return db.select().from(siteVisits).orderBy(siteVisits.visitedAt, siteVisits.id);
}

/** "Chrome 142 · Windows 10 · mobile", or null when the browser says nothing useful. */
export function browserLabel(ua: string | null): string | null {
  if (!ua) return null;
  const { browser, os, device, isBot } = userAgent({ headers: new Headers({ "user-agent": ua }) });
  const parts = [
    [browser.name, browser.version?.split(".")[0]].filter(Boolean).join(" "),
    [os.name, os.version].filter(Boolean).join(" "),
    device.type ?? "",
    isBot ? "bot" : "",
  ].filter((part) => part !== "");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * One CSV field. Visitors control the path, browser and referrer, so a value that a spreadsheet
 * would run as a formula (=, +, -, @, tab, carriage return) is prefixed with an apostrophe.
 */
function csvField(value: string | null): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A time zone to show visit times in: an IANA name and the short label shown with the times. */
export interface TimeZone {
  id: string;
  label: string;
}

/** A sortable "2026-11-19 13:12:30" timestamp in the given time zone. */
export function localTimestamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

const CSV_COLUMNS = ["path", "ip", "country", "region", "city", "user_agent", "referrer"] as const;

/**
 * All visits as CSV, with a byte-order mark so spreadsheet programs read it as UTF-8. Each visit's time
 * comes first in `timeZone` (the admin page's), then in UTC as stored.
 */
export function visitsCsv(visits: SiteVisit[], timeZone: TimeZone): string {
  const header = [`visited_at_${timeZone.label.toLowerCase()}`, "visited_at_utc", ...CSV_COLUMNS];
  const lines = visits.map((v) =>
    [localTimestamp(v.visitedAt, timeZone.id), v.visitedAt.toISOString(), v.path, v.ip, v.country, v.region, v.city, v.userAgent, v.referrer]
      .map(csvField)
      .join(","),
  );
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
