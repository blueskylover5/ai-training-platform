import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { siteConfig, visitConfig } from "@/config";
import { getDb } from "@/db/server";
import { adminAccess, adminSettings } from "@/visits/admin-auth";
import { browserLabel, recentVisits, visitSummary, type SiteVisit } from "@/visits/report";
import { pageWidth } from "../../_components/page-width";

export const metadata: Metadata = {
  title: `Visitor log · ${siteConfig.shortName}`,
  robots: { index: false, follow: false },
};

/** The visitor log (VIS-03, ADR 0008), for the owner only: proxy.ts asks for the admin password. */
export default function VisitsPage({ searchParams }: PageProps<"/admin/visits">) {
  return (
    <main className="flex-1">
      <div className={`${pageWidth} py-12 sm:py-16`}>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Visitor log</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-ink-2 sm:text-lg sm:leading-8">
          Every page view on the site: time (UTC), page, IP address, approximate location and browser. Records are kept
          without a time limit. Only you can see this page.
        </p>
        <Suspense fallback={<p className="mt-10 text-ink-2">Loading the visitor log…</p>}>
          <Report searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

const time = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const number = new Intl.NumberFormat("en-US");

async function Report({ searchParams }: { searchParams: PageProps<"/admin/visits">["searchParams"] }) {
  // proxy.ts asks for the password first; checked again here in case it ever stops matching.
  const requestHeaders = await headers();
  if (adminAccess(requestHeaders.get("authorization"), adminSettings()) !== "allowed") notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(String(pageParam ?? "1"), 10) || 1);
  // The figures depend on the time of the request ("last 24 hours"), so never prerender them.
  await connection();
  const db = getDb();
  const { pageSize, topCount } = visitConfig.admin;
  const [summary, { visits, hasOlder }] = await Promise.all([
    visitSummary(db, new Date(), topCount),
    recentVisits(db, page, pageSize),
  ]);

  const tiles = [
    ["Last 24 hours", summary.last24Hours],
    ["Last 7 days", summary.last7Days],
    ["Last 30 days", summary.last30Days],
    ["All time", summary.allTime],
    ["Different IPs, 7 days", summary.addresses7Days],
  ] as const;

  return (
    <>
      <dl className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse justify-end rounded-2xl border border-line bg-surface p-5">
            <dt className="mt-1 text-sm text-ink-2">{label}</dt>
            <dd className="text-3xl font-bold tracking-tight text-ink tabular-nums">{number.format(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopList
          title="Top pages, last 7 days"
          rows={summary.topPages.map((p) => ({ label: p.path, visits: p.visits }))}
        />
        <TopList
          title="Top countries, last 7 days"
          rows={summary.topCountries.map((c) => ({ label: c.country ?? "Unknown", visits: c.visits }))}
        />
      </div>

      <section aria-labelledby="latest-title" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="latest-title" className="text-2xl font-semibold tracking-tight text-ink">
            Latest visits{page > 1 ? `, page ${page}` : ""}
          </h2>
          <a href="/admin/visits/export" download className="font-semibold">
            Download all as CSV
          </a>
        </div>
        {visits.length === 0 ? (
          <p className="mt-6 text-ink-2">No visits recorded yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
            <VisitTable visits={visits} />
          </div>
        )}
        <nav aria-label="Pages of visits" className="mt-6 flex gap-6">
          {page > 1 && <Link href={page === 2 ? "/admin/visits" : `/admin/visits?page=${page - 1}`}>← Newer</Link>}
          {hasOlder && <Link href={`/admin/visits?page=${page + 1}`}>Older →</Link>}
        </nav>
      </section>
    </>
  );
}

function TopList({ title, rows }: { title: string; rows: Array<{ label: string; visits: number }> }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-ink-2">No visits yet.</p>
      ) : (
        <table className="mt-3 w-full border-collapse text-left text-base">
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-0">
                <th scope="row" className="py-2 pr-4 font-normal break-all text-ink">
                  {row.label}
                </th>
                <td className="py-2 text-right tabular-nums text-ink">{number.format(row.visits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function VisitTable({ visits }: { visits: SiteVisit[] }) {
  return (
    <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
      <caption className="sr-only">Latest visits, newest first</caption>
      <thead>
        <tr className="border-b border-line text-ink-2">
          {["Time (UTC)", "Page", "IP address", "Location", "Browser", "Came from"].map((c) => (
            <th key={c} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {visits.map((v) => (
          <tr key={v.id} className="border-b border-line align-top last:border-0">
            <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-ink">{time.format(v.visitedAt)}</td>
            <td className="px-4 py-2.5 break-all text-ink">{v.path}</td>
            <td className="px-4 py-2.5 font-mono text-xs break-all text-ink">{v.ip ?? "Unknown"}</td>
            <td className="px-4 py-2.5 text-ink">{[v.city, v.region, v.country].filter(Boolean).join(", ") || "Unknown"}</td>
            <td className="px-4 py-2.5 text-ink" title={v.userAgent ?? undefined}>
              {browserLabel(v.userAgent) ?? "Unknown"}
            </td>
            <td className="px-4 py-2.5 break-all text-ink-2">{v.referrer ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
