import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { siteConfig, trendsConfig } from "@/config";
import { getDb } from "@/db/server";
import { formatCount, formatShortDate, isStale } from "@/trends/present";
import { getPlatformRace, type PlatformRaceData } from "@/trends/queries";
import { buildRaces, toBoard } from "@/trends/race";
import { ChartCard, DataTable } from "../_components/chart-card";
import { NoDataYet, StaleNotice } from "../_components/notices";
import { RaceBoard } from "./race-board";

export const metadata: Metadata = {
  title: `The platform race · ${siteConfig.shortName}`,
  description:
    "Which AI training platforms are hiring hardest? An animated leaderboard of open roles, new roles this week and big-pay roles, updated daily.",
};

export default function PlatformsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
      <section className="pt-10 pb-8 sm:pt-14">
        <p className="text-sm font-medium text-ink-2">
          <span aria-hidden="true">🏁 </span>The platform race
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Which AI training platforms are hiring hardest?
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-ink-2">
          Dozens of platforms pay people to help train AI. Pick a race to see who leads on open roles, on new roles this
          week and on big pay, then switch and watch the order change. Updated every day.
        </p>
      </section>
      <Suspense fallback={<RaceLoading />}>
        <Race />
      </Suspense>
      <WhatTheWorkIs />
    </main>
  );
}

async function Race() {
  // Read the database only when a request comes in, never while building (no database at build time).
  await io();
  const data = await getPlatformRace(getDb());
  if (!data) return <NoDataYet />;

  const stale = isStale(data.roles.fetchedAt, new Date());
  const races = buildRaces(data, trendsConfig.race);
  return (
    <div className="flex flex-col gap-6">
      {stale && <StaleNotice dataDate={data.roles.dataDate} />}
      <ChartCard
        id="race"
        title="Pick a race"
        dataDate={data.roles.dataDate}
        description={raceDescription(data)}
        table={<RaceTable data={data} />}
      >
        <RaceBoard board={toBoard(races, trendsConfig.race.size)} />
      </ChartCard>
    </div>
  );
}

function raceDescription({ platforms, stats }: PlatformRaceData) {
  const field = `${formatCount(platforms.length)} platforms`;
  if (!stats) {
    return `${field} race on open roles. Races on new roles and big pay start after the next daily update.`;
  }
  return `Three races between the same ${field}: open roles, roles first listed since ${formatShortDate(stats.newSince)}, and roles advertising $${formatCount(stats.bigPayMinHourlyUsd)} or more an hour. Places that change when you switch races are marked ▲ or ▼.`;
}

function RaceTable({ data }: { data: PlatformRaceData }) {
  const { platforms, stats } = data;
  const threshold = stats ? `$${formatCount(stats.bigPayMinHourlyUsd)}+/h` : null;
  const columns = ["Platform", "Open roles"];
  if (stats && threshold) {
    columns.push(`New since ${formatShortDate(stats.newSince)}`, `Roles at ${threshold}`, `Share at ${threshold}`);
  }
  return (
    <DataTable
      caption="The platform race: every platform's figures"
      columns={columns}
      rows={platforms.map((p) => {
        const cells = [p.name, formatCount(p.openRoles)];
        if (stats) {
          const s = p.stats;
          cells.push(
            s ? formatCount(s.newRoles) : "–",
            s ? formatCount(s.bigPayRoles) : "–",
            s && s.openRoles > 0 ? `${Math.round((s.bigPayRoles / s.openRoles) * 100)}%` : "–",
          );
        }
        return { key: p.slug, cells };
      })}
    />
  );
}

function RaceLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading the race…</span>
      <div className="h-[36rem] animate-pulse rounded-xl border border-line bg-surface" />
    </div>
  );
}

const kindsOfWork = [
  {
    emoji: "✍️",
    title: "Write and rate answers",
    text: "Write the answer a good assistant should give, or compare two AI answers and explain which is better.",
  },
  {
    emoji: "🔎",
    title: "Check AI in your field",
    text: "Doctors, lawyers, engineers, coders and other experts test AI on their subject and point out its mistakes.",
  },
  {
    emoji: "🗣️",
    title: "Use your languages",
    text: "Translate, review and record speech so AI works well in more languages and accents.",
  },
];

function WhatTheWorkIs() {
  return (
    <section aria-labelledby="work-title" className="mt-10">
      <h2 id="work-title" className="text-lg font-semibold tracking-tight text-ink">
        What do these platforms hire people for?
      </h2>
      <ul role="list" className="mt-4 grid gap-3 sm:grid-cols-3">
        {kindsOfWork.map((k) => (
          <li key={k.title} className="rounded-xl border border-line bg-surface p-5">
            <p aria-hidden="true" className="text-2xl">
              {k.emoji}
            </p>
            <h3 className="mt-2 font-semibold tracking-tight text-ink">{k.title}</h3>
            <p className="mt-1 text-sm leading-6 text-ink-2">{k.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-2">
        <Link href="/#kind-of-work">See every kind of work</Link> and{" "}
        <Link href="/#pay">what each one advertises per hour</Link> on the Trends page.
      </p>
    </section>
  );
}
