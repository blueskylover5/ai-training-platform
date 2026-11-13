import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense, type ReactNode } from "react";
import { siteConfig, trendsConfig } from "@/config";
import { getDb } from "@/db/server";
import { bigPayOdds, payHighlights, sectorShares, type BigPayOdds, type SectorShare } from "@/trends/insights";
import { formatCount, formatDataDate, formatMoney, formatShortDate, isStale, publicPay } from "@/trends/present";
import { getPlatformRace, getTrendsOverview, type PlatformRaceData, type TrendsOverview } from "@/trends/queries";
import { buildRaces, toBoard } from "@/trends/race";
import { ChartCard, DataExtras, DataTable } from "../_components/chart-card";
import { BarList, PayRanges } from "../_components/charts";
import { NoDataYet, StaleNotice } from "../_components/notices";
import { pageWidth } from "../_components/page-width";
import { ContactSection } from "./contact-section";
import { RaceBoard } from "./race-board";

export const metadata: Metadata = {
  title: `AI training platforms: who's hiring, which fields and what they pay · ${siteConfig.shortName}`,
  description:
    "How AI training platforms compare today: open and new roles, projects by sector and advertised pay, updated daily. Stuck? Contact us.",
};

const sections = [
  { id: "platforms", number: 1, label: "Platforms", hint: "Who is hiring" },
  { id: "sectors", number: 2, label: "Sectors", hint: "Fields in demand" },
  { id: "pay", number: 3, label: "Pay", hint: "What roles advertise" },
  { id: "contact", number: 4, label: "Contact", hint: "Get help" },
] as const;

export default function PlatformsPage() {
  return (
    <main className="flex-1">
      <Hero />
      <Suspense fallback={<LiveLoading />}>
        <LiveSections />
      </Suspense>
      <ContactSection />
    </main>
  );
}

function Hero() {
  return (
    <section className="border-b border-line">
      <div className={`${pageWidth} py-14 sm:py-20 lg:py-24`}>
        <p className="inline-flex items-center gap-2 rounded-full bg-tint px-4 py-1.5 text-sm font-semibold text-ink-2">
          <span aria-hidden="true">🏁</span> Updated every day
        </p>
        <h1 className="mt-6 max-w-4xl text-4xl leading-[1.1] font-bold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
          Get paid to help train AI. See where the work is.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9">
          Dozens of platforms pay people to write, check and rate AI answers. Here is how they compare today: who is
          hiring, which fields need people and what the roles advertise per hour. Stuck? We&apos;re here to help.
        </p>
        <nav aria-label="On this page" className="mt-10 sm:mt-12">
          <ol className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-ink hover:no-underline sm:gap-4 sm:p-5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-base font-bold text-page sm:size-10"
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
      </div>
    </section>
  );
}

async function LiveSections() {
  // Read the database only when a request comes in, never while building (no database at build time).
  await io();
  const db = getDb();
  const [overview, race] = await Promise.all([
    getTrendsOverview(db, { weeks: trendsConfig.overviewWeeks }),
    getPlatformRace(db),
  ]);
  if (!overview || !race) {
    return (
      <div className={`${pageWidth} py-16`}>
        <NoDataYet />
      </div>
    );
  }

  const stale = isStale(overview.roles.fetchedAt, new Date());
  return (
    <>
      <AtAGlance overview={overview} race={race} stale={stale} />
      <PlatformsSection race={race} />
      <SectorsSection overview={overview} />
      <PaySection overview={overview} race={race} />
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
            className="flex size-8 items-center justify-center rounded-full bg-ink text-sm tracking-normal text-page"
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

function AtAGlance({ overview, race, stale }: { overview: TrendsOverview; race: PlatformRaceData; stale: boolean }) {
  const { totals } = overview.roles;
  const counted = race.platforms.flatMap((p) => (p.stats ? [p.stats] : []));
  const bigPay = race.stats ? counted.reduce((sum, s) => sum + s.bigPayRoles, 0) : null;
  const tiles = [
    { label: "Open roles", value: formatCount(totals.openRoles) },
    { label: "Platforms hiring", value: formatCount(totals.platformsLive) },
    { label: "New roles in the last 7 days", value: formatCount(totals.newLast7d) },
    ...(bigPay !== null && race.stats
      ? [{ label: `Roles advertising $${formatCount(race.stats.bigPayMinHourlyUsd)}+ an hour`, value: formatCount(bigPay) }]
      : []),
  ];
  return (
    <section aria-labelledby="glance-heading" className="pt-12 sm:pt-16">
      <div className={pageWidth}>
        {stale && (
          <div className="mb-8">
            <StaleNotice dataDate={totals.dataDate} />
          </div>
        )}
        <h2 id="glance-heading" className="text-lg font-semibold text-ink-2">
          Today at a glance · <span className="text-ink">{formatDataDate(totals.dataDate)}</span>
        </h2>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col-reverse justify-end rounded-2xl border border-line bg-surface p-5 sm:p-7">
              <dt className="mt-2 text-sm leading-5 text-ink-2 sm:text-base sm:leading-6">{t.label}</dt>
              <dd className="text-3xl font-bold tracking-tight text-ink tabular-nums sm:text-5xl">{t.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function PlatformsSection({ race }: { race: PlatformRaceData }) {
  const races = buildRaces(race, trendsConfig.race);
  return (
    <PageSection
      id="platforms"
      eyebrow="Platform status"
      title="How are the platforms doing?"
      intro={
        <p>
          {formatCount(race.platforms.length)} platforms race on open roles, on new roles this week and on big pay.
          Pick a race and watch the order change.
        </p>
      }
    >
      <ChartCard
        id="race"
        headingLevel="h3"
        title="Pick a race"
        dataDate={race.roles.dataDate}
        description={raceDescription(race)}
        table={<RaceTable data={race} />}
      >
        <RaceBoard board={toBoard(races, trendsConfig.race.size)} />
      </ChartCard>
    </PageSection>
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

function SectorsSection({ overview }: { overview: TrendsOverview }) {
  const { totals, workTypes, dataDate } = overview.roles;
  const sectors = sectorShares(workTypes, totals.openRoles);
  return (
    <PageSection
      id="sectors"
      tinted
      eyebrow="Projects by sector"
      title="Which fields need people right now?"
      intro={
        <p>
          Open roles on {formatDataDate(dataDate)}, grouped by the kind of work they ask for:{" "}
          {formatCount(totals.openRoles)} roles across {sectors.length} sectors.
        </p>
      }
    >
      <ol role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {sectors.map((s) => (
          <SectorCard key={s.slug} sector={s} />
        ))}
      </ol>
      <DataExtras
        dataDate={dataDate}
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

function PaySection({ overview, race }: { overview: TrendsOverview; race: PlatformRaceData }) {
  const payRows = overview.pay?.rows ?? [];
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
          What open roles advertise per hour, by sector and by platform. This is advertised pay, not what people earn.
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
        <PayBySector overview={overview} />
        <BigPayOddsCard race={race} odds={odds} />
      </div>
    </PageSection>
  );
}

/** ["A", "B", "C"] → "A, B and C" */
function listOf(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function PayBySector({ overview }: { overview: TrendsOverview }) {
  if (!overview.pay || overview.pay.rows.length === 0) return null;
  const { dataDate, rows } = overview.pay;
  const items = rows.map((r) => ({ ...r, key: r.slug, visible: publicPay(r).visible }));
  const totalSamples = rows.reduce((sum, r) => sum + r.rateSamples, 0);
  return (
    <ChartCard
      id="pay-by-sector"
      headingLevel="h3"
      title="Advertised hourly pay by sector"
      dataDate={dataDate}
      description={
        <>
          The dot is the median; the bar is the typical range. Based on {formatCount(totalSamples)} advertised rates.
          Figures resting on fewer than {trendsConfig.minPaySamples} rates are hidden.
        </>
      }
      table={
        <DataTable
          caption="Advertised hourly pay by sector"
          columns={["Sector", "Median", "Typical range", "Rates", "Platforms"]}
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
      <PayRanges items={items} hiddenNote={`Fewer than ${trendsConfig.minPaySamples} advertised rates, so not shown`} />
    </ChartCard>
  );
}

function BigPayOddsCard({ race, odds }: { race: PlatformRaceData; odds: BigPayOdds[] }) {
  const { stats } = race;
  if (!stats) return null;
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
          range. Platforms with at least {min} open roles; the top {top.length} are shown and the data table lists all{" "}
          {odds.length}.
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
