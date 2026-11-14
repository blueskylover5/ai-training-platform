import { bigPayOdds } from "./insights";
import { formatCount, formatDataDate, formatShortDate } from "./present";
import type { PlatformRaceData } from "./queries";

/**
 * The platform race (TRD-11): three rankings of the same platforms, with a few lines of
 * commentary each. Everything here is plain data, so the server prepares it and the
 * animated board on the page only has to draw it.
 */

export type RaceKey = "open" | "new" | "big-pay";

export interface RaceEntry {
  slug: string;
  name: string;
  value: number;
  /** Shared by tied platforms: 1, 2, 2, 4… */
  rank: number;
  /** Extra context for the tooltip, or null. */
  detail: string | null;
}

export interface RaceView {
  key: RaceKey;
  emoji: string;
  label: string;
  question: string;
  /** Unit after a number: "open roles", "new roles"… */
  unit: string;
  /** What is counted, the date and the sample size (TRD-06). */
  description: string;
  dataDate: string | null;
  available: boolean;
  /** Why the race is not available yet. */
  unavailableNote: string | null;
  commentary: string[];
  /** Every platform, best first. */
  entries: RaceEntry[];
}

export interface RaceOptions {
  /** How many platforms run in each race. */
  size: number;
  /** A platform needs this many open roles before its big-pay share is quoted. */
  minOpenRolesForShare: number;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 23 → "23rd" */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

/** Most first; ties share a rank and are listed by name. */
export function rankEntries(items: Array<{ slug: string; name: string; value: number; detail?: string | null }>): RaceEntry[] {
  const sorted = [...items].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "en"));
  return sorted.map((item) => ({
    slug: item.slug,
    name: item.name,
    value: item.value,
    rank: 1 + sorted.filter((other) => other.value > item.value).length,
    detail: item.detail ?? null,
  }));
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function leaderLine(entries: RaceEntry[], unit: string, lead: (name: string, value: string) => string): string {
  const [first, second] = entries;
  if (!first || first.value === 0) return `Nobody has any ${unit} yet.`;
  if (second && second.value === first.value) {
    return `${first.name} and ${second.name} are neck and neck on ${formatCount(first.value)} ${unit}.`;
  }
  const gap = second ? `, ${formatCount(first.value - second.value)} ahead of ${second.name}` : "";
  return `${lead(first.name, formatCount(first.value))}${gap}.`;
}

/** The platform that climbs the most places compared with another race, among this race's top `size`. */
function biggestClimber(entries: RaceEntry[], compareTo: RaceEntry[], size: number) {
  const before = new Map(compareTo.map((e) => [e.slug, e.rank]));
  let best: { entry: RaceEntry; from: number } | null = null;
  for (const entry of entries.slice(0, size)) {
    const from = before.get(entry.slug);
    if (from === undefined || entry.value === 0 || from <= entry.rank) continue;
    if (!best || from - entry.rank > best.from - best.entry.rank) best = { entry, from };
  }
  return best;
}

export function buildRaces(data: PlatformRaceData, options: RaceOptions): RaceView[] {
  const { platforms, roles, stats } = data;
  const total = platforms.length;
  const openRolesTotal = platforms.reduce((sum, p) => sum + p.openRoles, 0);

  const open = rankEntries(platforms.map((p) => ({ slug: p.slug, name: p.name, value: p.openRoles })));
  const top3Share = percent(
    open.slice(0, 3).reduce((sum, e) => sum + e.value, 0),
    openRolesTotal,
  );
  const openRace: RaceView = {
    key: "open",
    emoji: "🏁",
    label: "Most open roles",
    question: "Who has the most open roles right now?",
    unit: "open roles",
    description: `Open roles on ${formatDataDate(roles.dataDate)}, across ${formatCount(total)} platforms. Places 1 to ${options.size} race here; the data table lists them all.`,
    dataDate: roles.dataDate,
    available: open.length > 0,
    unavailableNote: null,
    commentary: [
      leaderLine(open, "open roles", (name, value) => `${name} leads with ${value} open roles`),
      `The top 3 hold ${top3Share}% of all ${formatCount(openRolesTotal)} open roles.`,
    ],
    entries: open,
  };

  const counted = platforms.filter((p) => p.stats !== null);
  const notYet = "Starts after the next daily update.";
  if (!stats || counted.length === 0) {
    const pending = (key: RaceKey, emoji: string, label: string): RaceView => ({
      ...openRace,
      key,
      emoji,
      label,
      available: false,
      unavailableNote: notYet,
      commentary: [],
      entries: [],
      dataDate: null,
    });
    return [openRace, pending("new", "🔥", "Hottest this week"), pending("big-pay", "💰", "Big pay")];
  }

  const threshold = `$${formatCount(stats.bigPayMinHourlyUsd)}`;
  const days =
    Math.round((Date.parse(`${stats.dataDate}T00:00:00Z`) - Date.parse(`${stats.newSince}T00:00:00Z`)) / 86_400_000) + 1;

  const fresh = rankEntries(
    counted.map((p) => ({
      slug: p.slug,
      name: p.name,
      value: p.stats!.newRoles,
      detail: `${formatCount(p.stats!.newRoles)} of ${formatCount(p.stats!.openRoles)} open roles are new`,
    })),
  );
  const quiet = fresh.filter((e) => e.value === 0).length;
  const climber = biggestClimber(fresh, open, options.size);
  const newRace: RaceView = {
    key: "new",
    emoji: "🔥",
    label: "Hottest this week",
    question: `Who listed the most new roles in the last ${days} days?`,
    unit: "new roles",
    description: `Open roles first listed from ${formatShortDate(stats.newSince)} to ${formatDataDate(stats.dataDate)}, across ${formatCount(counted.length)} platforms.`,
    dataDate: stats.dataDate,
    available: true,
    unavailableNote: null,
    commentary: [
      leaderLine(fresh, "new roles", (name, value) => `${name} is on fire with ${value} new roles`),
      climber
        ? `Biggest climber: ${climber.entry.name}, from ${ordinal(climber.from)} for open roles to ${ordinal(climber.entry.rank)} here.`
        : null,
      quiet > 0 ? `${formatCount(quiet)} of ${formatCount(counted.length)} platforms listed nothing new.` : null,
    ].filter((line): line is string => line !== null),
    entries: fresh,
  };

  const bigPay = rankEntries(
    counted.map((p) => ({
      slug: p.slug,
      name: p.name,
      value: p.stats!.bigPayRoles,
      detail: `${percent(p.stats!.bigPayRoles, p.stats!.openRoles)}% of its ${formatCount(p.stats!.openRoles)} open roles`,
    })),
  );
  const [bestOdds] = bigPayOdds(data.platforms, options.minOpenRolesForShare);
  const openLeader = open[0];
  const openLeaderHere = openLeader ? bigPay.find((e) => e.slug === openLeader.slug) : undefined;
  const bigPayRace: RaceView = {
    key: "big-pay",
    emoji: "💰",
    label: "Big pay",
    question: `Who has the most roles advertising ${threshold}+ an hour?`,
    unit: `roles at ${threshold}+/h`,
    description: `Open roles whose advertised hourly pay goes up to ${threshold} or more, on ${formatDataDate(stats.dataDate)}, across ${formatCount(counted.length)} platforms. This is what roles advertise, not what people earn.`,
    dataDate: stats.dataDate,
    available: true,
    unavailableNote: null,
    commentary: [
      leaderLine(bigPay, `roles at ${threshold}+`, (name, value) => `${name} takes the money lap with ${value} roles at ${threshold}+`),
      bestOdds
        ? `Best odds: ${bestOdds.sharePercent}% of ${bestOdds.name}'s ${formatCount(bestOdds.openRoles)} open roles advertise ${threshold}+.`
        : null,
      openLeader && openLeaderHere && openLeaderHere.rank > 3
        ? openLeaderHere.value === 0
          ? `Plot twist: ${openLeader.name}, 1st for open roles, has none at ${threshold}+.`
          : `Plot twist: ${openLeader.name}, 1st for open roles, is only ${ordinal(openLeaderHere.rank)} here.`
        : null,
    ].filter((line): line is string => line !== null),
    entries: bigPay,
  };

  return [openRace, newRace, bigPayRace];
}

export interface BoardEntry extends RaceEntry {
  /** Runs in this race: ranked within the top `size` and above zero. Ties at the cut-off all run. */
  racing: boolean;
}

export interface BoardRace extends Omit<RaceView, "entries"> {
  /** Only the platforms that have a lane, best first. */
  entries: BoardEntry[];
}

export interface RaceBoardData {
  races: BoardRace[];
  /** Every platform that runs in at least one race, so it can slide in and out when races switch. */
  lanes: Array<{ slug: string; name: string }>;
}

/** Trims the races to what the animated board draws. */
export function toBoard(races: RaceView[], size: number): RaceBoardData {
  const isRacing = (e: RaceEntry) => e.value > 0 && e.rank <= size;
  const lanes = new Map<string, string>();
  for (const race of races.filter((r) => r.available)) {
    for (const e of race.entries.filter(isRacing)) if (!lanes.has(e.slug)) lanes.set(e.slug, e.name);
  }
  return {
    races: races.map((race) => ({
      ...race,
      entries: race.entries.filter((e) => lanes.has(e.slug)).map((e) => ({ ...e, racing: isRacing(e) })),
    })),
    lanes: [...lanes].map(([slug, name]) => ({ slug, name })),
  };
}
