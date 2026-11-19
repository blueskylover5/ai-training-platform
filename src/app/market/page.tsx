import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { siteConfig, trendsConfig } from "@/config";
import { getDb } from "@/db/server";
import {
  formatChange,
  formatCount,
  formatDataDate,
  formatShortDate,
  formatUpdateTime,
  isStale,
  updateCadence,
} from "@/trends/present";
import { getTrendsOverview, type TotalsFigures, type TrendsOverview } from "@/trends/queries";
import { ChartCard, DataTable } from "../_components/chart-card";
import { ContactTeaser } from "../_components/contact-teaser";
import { BarList, WeeklyColumns } from "../_components/charts";
import { Credit } from "../_components/credit";
import { HeroCta } from "../_components/hero-cta";
import { NoDataYet, StaleNotice } from "../_components/notices";
import { pageWidth } from "../_components/page-width";
import { PayBySectorCard } from "../_components/pay-by-sector-card";

export const metadata: Metadata = {
  title: `The AI training job market: open roles, kinds of work and pay · ${siteConfig.shortName}`,
  description: `How many AI training roles are open, what kind of work they need, what they advertise per hour and which platforms are hiring, updated ${updateCadence()}. Free.`,
};

/** The job market overview (TRD-09). It was the home page until the site became ATRE (19 November 2026). */
export default function MarketPage() {
  return (
    <main className={`${pageWidth} flex-1 pb-20 sm:pb-28`}>
      <section className="pt-14 pb-10 sm:pt-20 sm:pb-14">
        <h1 className="max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
          The AI training job market, updated {updateCadence()}
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9">
          How many AI training roles are open, what kind of work they need, what they advertise per hour, and which
          platforms are hiring. Free, no sign-up.
        </p>
        <HeroCta className="mt-8" />
      </section>
      <Suspense fallback={<OverviewLoading />}>
        <Overview />
      </Suspense>
      <ContactTeaser className="mt-12 sm:mt-16" />
    </main>
  );
}

async function Overview() {
  // Read the database only when a request comes in, never while building (no database at build time).
  await io();
  const data = await getTrendsOverview(getDb(), { weeks: trendsConfig.overviewWeeks });
  if (!data) return <NoDataYet />;

  const stale = isStale(data.roles.fetchedAt, new Date());
  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      {stale && <StaleNotice dataDate={data.roles.dataDate} updatedAt={data.roles.updatedAt} />}
      <Headline totals={data.roles.totals} previous={data.roles.previous} updatedAt={data.roles.updatedAt} />
      <NewRolesChart data={data} />
      <KindOfWorkChart data={data} />
      <PayChart data={data} />
      <PlatformsChart data={data} />
    </div>
  );
}

function Headline({
  totals,
  previous,
  updatedAt,
}: {
  totals: TotalsFigures;
  previous: TotalsFigures | null;
  updatedAt: Date;
}) {
  const tiles = [
    { label: "Open roles", value: totals.openRoles, before: previous?.openRoles },
    { label: "Platforms hiring", value: totals.platformsLive, before: previous?.platformsLive },
    { label: "New roles in the last 7 days", value: totals.newLast7d, before: previous?.newLast7d },
  ];
  return (
    <section aria-labelledby="headline-title">
      <h2 id="headline-title" className="text-lg font-semibold text-ink-2">
        Figures for <span className="text-ink">{formatDataDate(totals.dataDate)}</span>, as of{" "}
        <span className="text-ink">{formatUpdateTime(updatedAt)}</span>
      </h2>
      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {tiles.map((t) => {
          const change = t.before === undefined ? null : formatChange(t.value, t.before);
          return (
            <div key={t.label} className="rounded-2xl border border-line bg-surface p-6 sm:p-7">
              <dt className="text-base text-ink-2">{t.label}</dt>
              <dd className="mt-2 text-4xl font-bold tracking-tight text-ink tabular-nums sm:text-5xl">{formatCount(t.value)}</dd>
              {change && previous && (
                <dd className="mt-2 text-sm text-ink-2">
                  <span aria-hidden="true">{change.direction === "up" ? "▲ " : change.direction === "down" ? "▼ " : ""}</span>
                  {change.text} since {formatShortDate(previous.dataDate)}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
      <Credit dataDate={totals.dataDate} className="mt-4" />
    </section>
  );
}

function NewRolesChart({ data }: { data: TrendsOverview }) {
  const { weekly } = data;
  if (weekly.length === 0) return null;
  return (
    <ChartCard
      id="new-roles"
      title="New roles per week"
      dataDate={data.roles.dataDate}
      description={
        <>
          Roles first listed each week (Monday to Sunday), whether still open or since closed. Platforms&apos; first week
          on the tracker is left out, and so is the current, unfinished week. {weekly.length} weeks shown.
        </>
      }
      table={
        <DataTable
          caption="New roles per week"
          columns={["Week starting", "New roles"]}
          rows={weekly.map((w) => ({ key: w.weekStart, cells: [formatDataDate(w.weekStart), formatCount(w.newRoles)] }))}
        />
      }
    >
      <WeeklyColumns weeks={weekly} />
    </ChartCard>
  );
}

function KindOfWorkChart({ data }: { data: TrendsOverview }) {
  const { totals, workTypes } = data.roles;
  return (
    <ChartCard
      id="kind-of-work"
      title="Open roles by kind of work"
      dataDate={data.roles.dataDate}
      description={
        <>
          Roles open on {formatDataDate(totals.dataDate)}, grouped by the kind of work they ask for.{" "}
          {formatCount(totals.openRoles)} open roles across {workTypes.length} kinds of work.
        </>
      }
      table={
        <DataTable
          caption="Open roles by kind of work"
          columns={["Kind of work", "Open roles", "Share"]}
          rows={workTypes.map((w) => ({
            key: w.slug,
            cells: [w.label, formatCount(w.openCount), `${Math.round((w.openCount / totals.openRoles) * 100)}%`],
          }))}
        />
      }
    >
      <BarList
        unit="open roles"
        total={totals.openRoles}
        items={workTypes.map((w) => ({ key: w.slug, label: w.label, value: w.openCount }))}
      />
    </ChartCard>
  );
}

function PayChart({ data }: { data: TrendsOverview }) {
  return (
    <PayBySectorCard
      id="pay"
      title="Advertised hourly pay by kind of work"
      rowLabel="Kind of work"
      lead="What open roles advertise per hour, not what people earn. "
      pay={data.pay}
    />
  );
}

function PlatformsChart({ data }: { data: TrendsOverview }) {
  const { totals, platforms } = data.roles;
  const top = platforms.slice(0, trendsConfig.overviewTopPlatforms);
  return (
    <ChartCard
      id="platforms"
      title="Open roles by platform"
      dataDate={data.roles.dataDate}
      description={
        <>
          The {top.length} platforms with the most open roles on {formatDataDate(totals.dataDate)}, out of{" "}
          {formatCount(platforms.length)} platforms hiring. The data table lists all of them.
        </>
      }
      table={
        <DataTable
          caption="Open roles by platform"
          columns={["Platform", "Open roles"]}
          rows={platforms.map((p) => ({ key: p.slug, cells: [p.name, formatCount(p.openCount)] }))}
        />
      }
    >
      <BarList
        unit="open roles"
        total={totals.openRoles}
        items={top.map((p) => ({ key: p.slug, label: p.name, value: p.openCount }))}
      />
      <p className="mt-8 text-base">
        <Link href="/platforms" className="font-semibold">
          Watch the platform race: who leads on new roles and big pay? →
        </Link>
      </p>
    </ChartCard>
  );
}

function OverviewLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <span className="sr-only">Loading the latest figures…</span>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-tint" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-tint" />
    </div>
  );
}

