import type { Metadata } from "next";
import { io } from "next/cache";
import Image from "next/image";
import { cache, Suspense, type ReactNode } from "react";
import { siteConfig, trendsConfig } from "@/config";
import { platformLogo } from "@/content/landing";
import { getDb } from "@/db/server";
import {
  bigPayOdds,
  payHighlights,
  sectorShares,
  topPicks,
  type BigPayOdds,
  type SectorShare,
  type TopPick,
} from "@/trends/insights";
import {
  formatChange,
  formatCount,
  formatDataDate,
  formatMoney,
  formatShortDate,
  formatUpdateTime,
  isStale,
  updateCadence,
} from "@/trends/present";
import { getPlatformGuide, type PlatformGuideData, type PlatformRaceData } from "@/trends/queries";
import { buildRaces, toBoard } from "@/trends/race";
import { ChartCard, DataExtras, DataTable } from "../_components/chart-card";
import { BarList, WeeklyColumns } from "../_components/charts";
import { ContactTeaser } from "../_components/contact-teaser";
import { Credit } from "../_components/credit";
import { HeroCta } from "../_components/hero-cta";
import { NoDataYet, StaleNotice } from "../_components/notices";
import { pageWidth } from "../_components/page-width";
import { PayBySectorCard } from "../_components/pay-by-sector-card";
import { RaceBoard } from "./race-board";
import { ForwardOldContactLink, ScrollToHash } from "./scroll-to-hash";

export const metadata: Metadata = {
  title: `The best AI training platforms right now · ${siteConfig.shortName}`,
  description: `Which AI training platforms have the most work, the most new roles and the best pay today, updated ${updateCadence()}. Trouble creating an account? We give full support.`,
};

const sections = [
  { id: "platforms", number: 1, label: "Platform ranking", hint: "Who has the most work" },
  { id: "sectors", number: 2, label: "Fields in demand", hint: "Where people are needed" },
  { id: "pay", number: 3, label: "Pay", hint: "What roles advertise" },
  { id: "trend", number: 4, label: "Hiring trend", hint: "New roles each week" },
] as const;

/**
 * One read of the figures per request, shared by the hero's top picks and the sections below
 * (React's cache lasts one request), so both describe the same published files.
 */
const loadGuide = cache(async () => {
  // Read the database only when a request comes in, never while building (no database at build time).
  await io();
  return getPlatformGuide(getDb(), { weeks: trendsConfig.bestPlatforms.weeks });
});

/**
 * The Best platforms page (owner's request, 23 November 2026): which AI training platforms to look
 * at, from the published figures. It replaced the Job market page (/market now redirects here) and
 * the Platform guide. The hero names today's leaders and offers help with creating an account;
 * each section below shows a short summary, and "View more" opens its full table.
 */
export default function BestPlatformsPage() {
  return (
    <main className="flex-1">
      <ForwardOldContactLink />
      <Hero />
      <Suspense fallback={<LiveLoading />}>
        <LiveSections />
      </Suspense>
      {/* The page ends with the way to get help, which has its own page (CON-01). */}
      <div className={`${pageWidth} pb-16 sm:pb-24`}>
        <ContactTeaser />
      </div>
    </main>
  );
}

function Hero() {
  return (
    <section className="border-b border-line bg-linear-to-b from-brand-wash to-page">
      <div className={`${pageWidth} py-14 sm:py-20`}>
        <p className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-1.5 text-sm font-semibold text-brand-ink ring-1 ring-brand-soft">
          <span aria-hidden="true">🏆</span> Updated {updateCadence()}
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
          The best AI training platforms right now
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9">
          We compare the AI training platforms {updateCadence()}: how much work each one has, how fast it is hiring and
          what its roles advertise per hour. These are today&apos;s leaders.
        </p>
        <Suspense fallback={<PicksLoading />}>
          <TopPicks />
        </Suspense>
        <SignUpSupport />
        <SectionNav />
      </div>
    </section>
  );
}

const pickLabels: Record<TopPick["kind"], { icon: string; label: string }> = {
  mostOpen: { icon: "📋", label: "Most open roles" },
  mostNew: { icon: "🚀", label: "Hiring fastest" },
  mostBigPay: { icon: "💰", label: "Most high-paying roles" },
  bestOdds: { icon: "🎯", label: "Best odds of high pay" },
};

async function TopPicks() {
  const guide = await loadGuide();
  // Without figures the sections below say so; the hero just leaves the picks out.
  if (!guide) return null;
  const { race } = guide;
  const picks = topPicks(race.platforms, bigPayOdds(race.platforms, trendsConfig.race.minOpenRolesForShare));
  if (picks.length === 0) return null;
  return (
    <section aria-labelledby="picks-heading" className="mt-10 sm:mt-12">
      <h2 id="picks-heading" className="text-lg font-semibold text-ink-2">
        Today&apos;s top picks · <span className="text-ink">{formatDataDate(guide.roles.dataDate)}</span>
      </h2>
      <ul role="list" className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {picks.map((pick) => (
          <PickCard key={pick.kind} pick={pick} race={race} />
        ))}
      </ul>
      <Credit dataDate={guide.roles.dataDate} className="mt-4" />
    </section>
  );
}

function PickCard({ pick, race }: { pick: TopPick; race: PlatformRaceData }) {
  const { icon, label } = pickLabels[pick.kind];
  const threshold = race.stats ? `$${formatCount(race.stats.bigPayMinHourlyUsd)}` : "";
  const figure = pick.kind === "bestOdds" ? `${pick.value}%` : formatCount(pick.value);
  const text: Record<TopPick["kind"], string> = {
    mostOpen: "open roles right now",
    mostNew: race.stats ? `new roles since ${formatShortDate(race.stats.newSince)}` : "new roles",
    mostBigPay: `roles advertising ${threshold}+ an hour`,
    bestOdds: pick.odds
      ? `of its roles advertise ${threshold}+ an hour (${formatCount(pick.odds.bigPayRoles)} of ${formatCount(pick.odds.openRoles)})`
      : `of its roles advertise ${threshold}+ an hour`,
  };
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(11,11,11,0.04)] sm:p-6">
      <p className="text-sm font-semibold text-brand-ink">
        <span aria-hidden="true">{icon}</span> {label}
      </p>
      <h3 className="mt-4 flex items-center gap-3 text-xl font-bold tracking-tight text-ink">
        <PlatformIcon name={pick.name} />
        <span className="min-w-0 break-words">{pick.name}</span>
      </h3>
      <p className="mt-auto pt-5 text-4xl font-bold tracking-tight text-ink tabular-nums">{figure}</p>
      <p className="mt-1 text-sm leading-6 text-ink-2">{text[pick.kind]}</p>
    </li>
  );
}

/** The platform's own site icon when we have it (src/content/landing.ts), else its first letter. */
function PlatformIcon({ name }: { name: string }) {
  const logo = platformLogo(name);
  if (logo) {
    // The name sits next to it, so the icon needs no description. Top of the page: load it right away.
    return <Image src={logo} alt="" width={40} height={40} loading="eager" className="size-10 shrink-0 rounded-xl border border-line object-contain" />;
  }
  return (
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** Help with creating an account, at the owner's request (23 November 2026). */
function SignUpSupport() {
  return (
    <aside
      aria-labelledby="signup-help-heading"
      className="mt-8 flex flex-col gap-6 rounded-2xl bg-brand-deep p-6 text-white sm:mt-10 sm:p-8 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex gap-4">
        <span aria-hidden="true" className="text-3xl leading-none sm:text-4xl">
          🤝
        </span>
        <div>
          <h2 id="signup-help-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            Having trouble creating an account?
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-brand-soft sm:text-lg sm:leading-8">
            Sign-up forms, verification and onboarding tests can stop you before you start. We give{" "}
            <strong className="font-semibold text-accent">full support</strong> to anyone who gets stuck, until your
            account is up and running.
          </p>
        </div>
      </div>
      <HeroCta onDark className="shrink-0" />
    </aside>
  );
}

function SectionNav() {
  return (
    <nav aria-label="On this page" className="mt-10 sm:mt-12">
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-ink hover:no-underline sm:gap-4 sm:p-5"
            >
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white sm:size-10"
              >
                {s.number}
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold text-ink">{s.label}</span>
                <span className="block text-sm text-ink-2">{s.hint}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

async function LiveSections() {
  const guide = await loadGuide();
  if (!guide) {
    return (
      <div className={`${pageWidth} py-16`}>
        <NoDataYet />
      </div>
    );
  }

  const stale = isStale(guide.roles.fetchedAt, new Date());
  return (
    <>
      <AtAGlance guide={guide} stale={stale} />
      <PlatformsSection race={guide.race} />
      <SectorsSection guide={guide} />
      <PaySection guide={guide} />
      <TrendSection guide={guide} />
      <ScrollToHash />
    </>
  );
}

/** One numbered page section with a big heading; alternate sections sit on a soft grey. */
function PageSection({
  id,
  eyebrow,
  title,
  intro,
  tinted = false,
  children,
}: {
  id: (typeof sections)[number]["id"];
  eyebrow: string;
  title: string;
  intro: ReactNode;
  tinted?: boolean;
  children: ReactNode;
}) {
  const number = sections.find((s) => s.id === id)?.number;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={`scroll-mt-4 py-16 sm:py-24 ${tinted ? "bg-tint" : ""}`}>
      <div className={pageWidth}>
        <p className="flex items-center gap-3 text-sm font-semibold tracking-widest text-ink-2 uppercase">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-brand text-sm tracking-normal text-white"
          >
            {number}
          </span>
          {eyebrow}
        </p>
        <h2 id={`${id}-heading`} className="mt-5 max-w-4xl text-3xl leading-tight font-bold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        <div className="mt-5 max-w-3xl text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9">{intro}</div>
        <div className="mt-10 sm:mt-14">{children}</div>
      </div>
    </section>
  );
}

function AtAGlance({ guide, stale }: { guide: PlatformGuideData; stale: boolean }) {
  const { totals, previous } = guide.roles;
  const { race } = guide;
  const counted = race.platforms.flatMap((p) => (p.stats ? [p.stats] : []));
  const bigPay = race.stats ? counted.reduce((sum, s) => sum + s.bigPayRoles, 0) : null;
  const tiles: Array<{ label: string; value: number; before?: number }> = [
    { label: "Open roles", value: totals.openRoles, before: previous?.openRoles },
    { label: "Platforms hiring", value: totals.platformsLive, before: previous?.platformsLive },
    { label: "New roles in the last 7 days", value: totals.newLast7d, before: previous?.newLast7d },
    ...(bigPay !== null && race.stats
      ? [{ label: `Roles advertising $${formatCount(race.stats.bigPayMinHourlyUsd)}+ an hour`, value: bigPay }]
      : []),
  ];
  return (
    <section aria-labelledby="glance-heading" className="pt-12 sm:pt-16">
      <div className={pageWidth}>
        {stale && (
          <div className="mb-8">
            <StaleNotice dataDate={totals.dataDate} updatedAt={guide.roles.updatedAt} />
          </div>
        )}
        <h2 id="glance-heading" className="text-lg font-semibold text-ink-2">
          Today at a glance · <span className="text-ink">{formatDataDate(totals.dataDate)}</span>, as of{" "}
          <span className="text-ink">{formatUpdateTime(guide.roles.updatedAt)}</span>
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {tiles.map((t) => {
            const change = t.before === undefined || !previous ? null : formatChange(t.value, t.before);
            return (
              <div key={t.label} className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-7">
                <dt className="order-2 mt-2 text-sm leading-5 text-ink-2 sm:text-base sm:leading-6">{t.label}</dt>
                <dd className="order-1 text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-5xl">{formatCount(t.value)}</dd>
                {change && previous && (
                  <dd className="order-3 mt-1 text-sm text-ink-3">
                    <span aria-hidden="true">{change.direction === "up" ? "▲ " : change.direction === "down" ? "▼ " : ""}</span>
                    {change.text} since {formatShortDate(previous.dataDate)}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
        <Credit dataDate={totals.dataDate} className="mt-4" />
      </div>
    </section>
  );
}

function PlatformsSection({ race }: { race: PlatformRaceData }) {
  const races = buildRaces(race, trendsConfig.race);
  return (
    <PageSection
      id="platforms"
      eyebrow="Platform ranking"
      title="Which platforms have the most work?"
      intro={
        race.stats ? (
          <p>
            The top {trendsConfig.race.size} of {formatCount(race.platforms.length)} platforms on open roles, on new roles
            this week and on high pay. Pick a race and watch the order change.
          </p>
        ) : (
          <p>
            The top {trendsConfig.race.size} of {formatCount(race.platforms.length)} platforms on open roles. Races on new
            roles and high pay start after the next update.
          </p>
        )
      }
    >
      <ChartCard
        id="race"
        headingLevel="h3"
        title="Pick a race"
        dataDate={race.roles.dataDate}
        description={raceDescription(race)}
        table={<RaceTable data={race} />}
        moreLabel={`View all ${formatCount(race.platforms.length)} platforms`}
      >
        <RaceBoard board={toBoard(races, trendsConfig.race.size)} />
      </ChartCard>
    </PageSection>
  );
}

function raceDescription({ platforms, stats }: PlatformRaceData) {
  const field = `${formatCount(platforms.length)} platforms`;
  if (!stats) {
    return `${field} race on open roles. Races on new roles and big pay start after the next update.`;
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
      caption="Every platform's figures"
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

function SectorsSection({ guide }: { guide: PlatformGuideData }) {
  const { totals, workTypes, dataDate } = guide.roles;
  const sectors = sectorShares(workTypes, totals.openRoles);
  const shown = sectors.slice(0, trendsConfig.bestPlatforms.sectorsShown);
  return (
    <PageSection
      id="sectors"
      tinted
      eyebrow="Fields in demand"
      title="Which fields need people right now?"
      intro={
        <p>
          Open roles on {formatDataDate(dataDate)}, grouped by the kind of work they ask for:{" "}
          {formatCount(totals.openRoles)} roles across {sectors.length} sectors.
          {shown.length < sectors.length && <> Here are the top {shown.length}.</>}
        </p>
      }
    >
      <ol role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {shown.map((s) => (
          <SectorCard key={s.slug} sector={s} />
        ))}
      </ol>
      <DataExtras
        dataDate={dataDate}
        moreLabel={`View all ${sectors.length} sectors`}
        table={
          <DataTable
            caption="Open roles by sector"
            columns={["Sector", "Open roles", "Share of all open roles"]}
            rows={sectors.map((s) => ({
              key: s.slug,
              cells: [s.label, formatCount(s.openRoles), `${s.sharePercent}%`],
            }))}
          />
        }
      />
    </PageSection>
  );
}

function SectorCard({ sector }: { sector: SectorShare }) {
  const share = sector.sharePercent < 1 ? "Under 1%" : `${sector.sharePercent}%`;
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm font-semibold text-ink-3">#{sector.rank}</p>
      <h3 className="mt-1 text-xl leading-snug font-semibold tracking-tight text-ink">{sector.label}</h3>
      <p className="mt-3 flex items-baseline gap-2 sm:mt-5">
        <span className="text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-4xl">{formatCount(sector.openRoles)}</span>
        <span className="text-base text-ink-2">open roles</span>
      </p>
      <div className="mt-auto pt-4 sm:pt-5">
        <div aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-grid">
          <div className="h-full rounded-full bg-series" style={{ width: `${Math.max(1, sector.sharePercent)}%` }} />
        </div>
        <p className="mt-2 text-sm text-ink-2">{share} of all open roles</p>
      </div>
    </li>
  );
}

function PaySection({ guide }: { guide: PlatformGuideData }) {
  const { race } = guide;
  const payRows = guide.pay?.rows ?? [];
  const odds = bigPayOdds(race.platforms, trendsConfig.race.minOpenRolesForShare);
  const highlights = payHighlights(race.platforms, race.stats?.bigPayMinHourlyUsd ?? null, payRows, odds);
  const threshold = race.stats ? `$${formatCount(race.stats.bigPayMinHourlyUsd)}` : null;

  const tiles: Array<{ key: string; value: string; text: ReactNode }> = [];
  if (highlights.bigPay && threshold) {
    tiles.push({
      key: "big-pay",
      value: `${highlights.bigPay.sharePercent}%`,
      text: (
        <>
          of open roles advertise pay that reaches {threshold} an hour or more ({formatCount(highlights.bigPay.roles)}{" "}
          of {formatCount(highlights.bigPay.openRoles)}).
        </>
      ),
    });
  }
  if (highlights.topSector) {
    tiles.push({
      key: "top-sector",
      value: `${formatMoney(highlights.topSector.median, highlights.topSector.currency)}/h`,
      text:
        highlights.topSector.labels.length === 1 ? (
          <>is the highest median advertised rate, in {highlights.topSector.labels[0]}.</>
        ) : (
          <>is the highest median advertised rate, shared by {listOf(highlights.topSector.labels)}.</>
        ),
    });
  }
  if (highlights.bestOdds && threshold) {
    tiles.push({
      key: "best-odds",
      value: `${highlights.bestOdds.sharePercent}%`,
      text: (
        <>
          of {highlights.bestOdds.name}&apos;s open roles advertise {threshold}+ an hour, the best odds of any platform with{" "}
          {trendsConfig.race.minOpenRolesForShare} or more open roles.
        </>
      ),
    });
  }

  return (
    <PageSection
      id="pay"
      eyebrow="Pay"
      title="What does the work pay?"
      intro={
        <p>
          What open roles advertise per hour, by platform and by sector. This is advertised pay, not what people earn.
        </p>
      }
    >
      <div className="flex flex-col gap-8 sm:gap-10">
        {tiles.length > 0 && (
          <ul role="list" className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
            {tiles.map((t) => (
              <li key={t.key} className="rounded-2xl border border-line bg-tint p-6 sm:p-7">
                <p className="text-4xl font-bold tracking-tight text-ink tabular-nums sm:text-5xl">{t.value}</p>
                <p className="mt-3 text-base leading-7 text-ink-2">{t.text}</p>
              </li>
            ))}
          </ul>
        )}
        <BigPayOddsCard race={race} odds={odds} />
        <PayBySectorCard
          id="pay-by-sector"
          headingLevel="h3"
          title="Advertised hourly pay by sector"
          rowLabel="Sector"
          pay={guide.pay}
          moreLabel="View the full pay table"
        />
      </div>
    </PageSection>
  );
}

/** ["A", "B", "C"] → "A, B and C" */
function listOf(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function BigPayOddsCard({ race, odds }: { race: PlatformRaceData; odds: BigPayOdds[] }) {
  const { stats } = race;
  // Nothing to rank before the first counts, or when no platform has enough roles with big pay.
  if (!stats || odds.length === 0) return null;
  const threshold = `$${formatCount(stats.bigPayMinHourlyUsd)}`;
  const top = odds.slice(0, trendsConfig.bigPayOddsTop);
  const min = trendsConfig.race.minOpenRolesForShare;
  return (
    <ChartCard
      id="big-pay-odds"
      headingLevel="h3"
      title={`Best odds of a ${threshold}+ an hour role`}
      dataDate={stats.dataDate}
      description={
        <>
          The share of each platform&apos;s open roles whose advertised hourly pay reaches {threshold} at the top of its
          range. Platforms with at least {min} open roles; the top {top.length} are shown.
        </>
      }
      table={
        <DataTable
          caption={`Share of open roles advertising ${threshold}+ an hour, by platform`}
          columns={["Platform", "Open roles", `Roles at ${threshold}+/h`, "Share"]}
          rows={odds.map((o) => ({
            key: o.slug,
            cells: [o.name, formatCount(o.openRoles), formatCount(o.bigPayRoles), `${o.sharePercent}%`],
          }))}
        />
      }
      moreLabel={`View all ${formatCount(odds.length)} platforms`}
    >
      <BarList
        unit="%"
        total={100}
        formatValue={(v) => `${v}%`}
        items={top.map((o) => ({ key: o.slug, label: o.name, value: o.sharePercent }))}
        tip={(item) => {
          const o = top.find((x) => x.slug === item.key)!;
          return `${o.name}: ${formatCount(o.bigPayRoles)} of ${formatCount(o.openRoles)} open roles (${o.sharePercent}%)`;
        }}
      />
    </ChartCard>
  );
}

function TrendSection({ guide }: { guide: PlatformGuideData }) {
  const { weekly } = guide;
  return (
    <PageSection
      id="trend"
      tinted
      eyebrow="Hiring trend"
      title="Is hiring going up or down?"
      intro={<p>New roles first listed each week, across all platforms.</p>}
    >
      {weekly.length === 0 ? (
        <p className="text-lg text-ink-2">Weekly figures appear here once the first weeks are counted.</p>
      ) : (
        <ChartCard
          id="new-roles"
          headingLevel="h3"
          title="New roles per week"
          dataDate={guide.roles.dataDate}
          description={
            <>
              Roles first listed each week (Monday to Sunday), whether still open or since closed. Platforms&apos; first
              week on the tracker is left out, and so is the current, unfinished week. {weekly.length} weeks shown.
            </>
          }
          table={
            <DataTable
              caption="New roles per week"
              columns={["Week starting", "New roles"]}
              rows={weekly.map((w) => ({ key: w.weekStart, cells: [formatDataDate(w.weekStart), formatCount(w.newRoles)] }))}
            />
          }
          moreLabel="View the weekly figures"
        >
          <WeeklyColumns weeks={weekly} />
        </ChartCard>
      )}
    </PageSection>
  );
}

function PicksLoading() {
  return (
    <div aria-busy="true" className="mt-10 grid grid-cols-1 gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-4">
      <span className="sr-only">Loading today&apos;s top picks…</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-52 animate-pulse rounded-2xl bg-surface ring-1 ring-line" />
      ))}
    </div>
  );
}

function LiveLoading() {
  return (
    <div aria-busy="true" className={`${pageWidth} flex flex-col gap-6 py-12 sm:py-16`}>
      <span className="sr-only">Loading the latest figures…</span>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-tint" />
        ))}
      </div>
      <div className="h-[40rem] animate-pulse rounded-2xl bg-tint" />
    </div>
  );
}
