import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { trendsConfig } from "@/config";
import { getDb } from "@/db/server";
import {
  formatChange,
  formatCount,
  formatDataDate,
  formatMoney,
  formatShortDate,
  isStale,
  publicPay,
} from "@/trends/present";
import { getTrendsOverview, type TotalsFigures, type TrendsOverview } from "@/trends/queries";
import { ChartCard, DataTable } from "./_components/chart-card";
import { BarList, PayRanges, WeeklyColumns } from "./_components/charts";
import { NoDataYet, StaleNotice } from "./_components/notices";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
      <section className="pt-10 pb-8 sm:pt-14">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          The AI training job market, updated daily
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-2">
          How many AI training roles are open, what kind of work they need, what they advertise per hour, and which
          platforms are hiring. Free, no sign-up.
        </p>
      </section>
      <Suspense fallback={<OverviewLoading />}>
        <Overview />
      </Suspense>
      <ExpertsComingSoon />
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
    <div className="flex flex-col gap-6">
      {stale && <StaleNotice dataDate={data.roles.dataDate} />}
      <Headline totals={data.roles.totals} previous={data.roles.previous} />
      <NewRolesChart data={data} />
      <KindOfWorkChart data={data} />
      <PayChart data={data} />
      <PlatformsChart data={data} />
    </div>
  );
}

function Headline({ totals, previous }: { totals: TotalsFigures; previous: TotalsFigures | null }) {
  const tiles = [
    { label: "Open roles", value: totals.openRoles, before: previous?.openRoles },
    { label: "Platforms hiring", value: totals.platformsLive, before: previous?.platformsLive },
    { label: "New roles in the last 7 days", value: totals.newLast7d, before: previous?.newLast7d },
  ];
  return (
    <section aria-labelledby="headline-title">
      <h2 id="headline-title" className="text-sm text-ink-2">
        Figures for <span className="font-medium text-ink">{formatDataDate(totals.dataDate)}</span>
      </h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => {
          const change = t.before === undefined ? null : formatChange(t.value, t.before);
          return (
            <div key={t.label} className="rounded-xl border border-line bg-surface px-5 py-4">
              <dt className="text-sm text-ink-2">{t.label}</dt>
              <dd className="mt-1 text-3xl font-semibold tracking-tight text-ink">{formatCount(t.value)}</dd>
              {change && previous && (
                <dd className="mt-1 text-xs text-ink-2">
                  <span aria-hidden="true">{change.direction === "up" ? "▲ " : change.direction === "down" ? "▼ " : ""}</span>
                  {change.text} since {formatShortDate(previous.dataDate)}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
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
  if (!data.pay || data.pay.rows.length === 0) return null;
  const { dataDate, rows } = data.pay;
  const items = rows.map((r) => ({ ...r, key: r.slug, visible: publicPay(r).visible }));
  const totalSamples = rows.reduce((sum, r) => sum + r.rateSamples, 0);
  const hiddenNote = `Fewer than ${trendsConfig.minPaySamples} advertised rates, so not shown`;

  return (
    <ChartCard
      id="pay"
      title="Advertised hourly pay by kind of work"
      dataDate={dataDate}
      description={
        <>
          What open roles advertise per hour, not what people earn. The dot is the median; the bar is the typical
          range. Based on {formatCount(totalSamples)} advertised rates. Figures resting on fewer than{" "}
          {trendsConfig.minPaySamples} rates are hidden.
        </>
      }
      table={
        <DataTable
          caption="Advertised hourly pay by kind of work"
          columns={["Kind of work", "Median", "Typical range", "Rates", "Platforms"]}
          rows={items.map((r) => ({
            key: r.key,
            cells: r.visible
              ? [
                  r.label,
                  formatMoney(r.median, r.currency),
                  `${formatMoney(r.typicalLow, r.currency)}–${formatMoney(r.typicalHigh, r.currency)}`,
                  formatCount(r.rateSamples),
                  formatCount(r.platforms),
                ]
              : [r.label, "Not shown", "Not shown", formatCount(r.rateSamples), formatCount(r.platforms)],
          }))}
        />
      }
    >
      <PayRanges items={items} hiddenNote={hiddenNote} />
    </ChartCard>
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
      <p className="mt-5 text-sm">
        <Link href="/platforms" className="font-medium">
          Watch the platform race: who leads on new roles and big pay? →
        </Link>
      </p>
    </ChartCard>
  );
}

function OverviewLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the latest figures…</span>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-surface" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl border border-line bg-surface" />
    </div>
  );
}

function ExpertsComingSoon() {
  return (
    <section aria-labelledby="experts-title" className="mt-10 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium tracking-wide text-ink-2 uppercase">Coming soon</p>
      <h2 id="experts-title" className="mt-1 text-lg font-semibold tracking-tight text-ink">
        Stuck on an AI training task?
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-2">
        You&apos;ll be able to contact people on our team who have done this work and solved the same problems, then
        talk by chat or a call. Free. Everyone follows their own platform&apos;s rules: never share task content,
        assessment answers or logins.
      </p>
    </section>
  );
}
