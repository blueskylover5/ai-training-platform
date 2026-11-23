import type { PayRow, RacePlatform, WorkTypeCount } from "./queries";
import { publicPay } from "./present";

/*
 * Figures for the Best platforms page (top picks, sectors and pay), worked out from published
 * snapshots only. Pure functions, so the page stays a thin layer over them.
 */

export interface SectorShare {
  slug: string;
  label: string;
  openRoles: number;
  /** Rounded share of all open roles, 0 to 100; the card's bar shows it too. */
  sharePercent: number;
  rank: number;
}

/** Sectors (kinds of work), most open roles first, with each one's share of all open roles. */
export function sectorShares(workTypes: readonly WorkTypeCount[], totalOpenRoles: number): SectorShare[] {
  const sorted = [...workTypes].sort((a, b) => b.openCount - a.openCount || a.label.localeCompare(b.label));
  return sorted.map((w, i) => ({
    slug: w.slug,
    label: w.label,
    openRoles: w.openCount,
    sharePercent: totalOpenRoles > 0 ? Math.round((w.openCount / totalOpenRoles) * 100) : 0,
    rank: i + 1,
  }));
}

export interface BigPayOdds {
  slug: string;
  name: string;
  openRoles: number;
  bigPayRoles: number;
  /** Rounded share of this platform's open roles that advertise the threshold or more, 0 to 100. */
  sharePercent: number;
}

/**
 * Platforms ranked by the share of their open roles that advertise big pay (TRD-11 counts).
 * Only platforms with at least `minOpenRoles` open roles count, so a platform with two roles
 * cannot top the list by chance. The one ranking behind both the race commentary's "Best odds"
 * and the Pay section, so they always name the same platform.
 */
export function bigPayOdds(platforms: readonly RacePlatform[], minOpenRoles: number): BigPayOdds[] {
  return platforms
    .flatMap((p) =>
      p.stats && p.stats.openRoles >= minOpenRoles
        ? [{ slug: p.slug, name: p.name, openRoles: p.stats.openRoles, bigPayRoles: p.stats.bigPayRoles }]
        : [],
    )
    .map((p) => ({ ...p, share: p.bigPayRoles / p.openRoles }))
    .filter((p) => p.bigPayRoles > 0)
    .sort((a, b) => b.share - a.share || b.bigPayRoles - a.bigPayRoles || a.name.localeCompare(b.name))
    .map(({ share, ...p }) => ({ ...p, sharePercent: Math.round(share * 100) }));
}

export interface PayHighlights {
  /** Every platform's big-pay roles added up, out of the open roles the same searches found. */
  bigPay: { roles: number; openRoles: number; sharePercent: number; minHourlyUsd: number } | null;
  /** The sector, or tied sectors, with the highest advertised median among figures that may be shown (TRD-08). */
  topSector: { labels: string[]; median: number; currency: string } | null;
  /** The platform with the best odds of a big-pay role. */
  bestOdds: BigPayOdds | null;
}

export function payHighlights(
  platforms: readonly RacePlatform[],
  bigPayMinHourlyUsd: number | null,
  payRows: readonly PayRow[],
  odds: readonly BigPayOdds[],
): PayHighlights {
  const counted = platforms.flatMap((p) => (p.stats ? [p.stats] : []));
  const roles = counted.reduce((sum, s) => sum + s.bigPayRoles, 0);
  const openRoles = counted.reduce((sum, s) => sum + s.openRoles, 0);

  const shown = payRows.filter((r) => publicPay(r).visible);
  const best = Math.max(...shown.map((r) => r.median));
  const tied = shown.filter((r) => r.median === best).sort((a, b) => b.rateSamples - a.rateSamples || a.label.localeCompare(b.label));
  const top = tied[0];

  return {
    bigPay:
      bigPayMinHourlyUsd !== null && openRoles > 0
        ? { roles, openRoles, sharePercent: Math.round((roles / openRoles) * 100), minHourlyUsd: bigPayMinHourlyUsd }
        : null,
    topSector: top ? { labels: tied.map((r) => r.label), median: top.median, currency: top.currency } : null,
    bestOdds: odds[0] ?? null,
  };
}

/** One of today's top picks on the Best platforms page: the leader on one measure. */
export interface TopPick {
  kind: "mostOpen" | "mostNew" | "mostBigPay" | "bestOdds";
  slug: string;
  name: string;
  /** The figure it leads on: open roles, new roles or big-pay roles, or the big-pay share in percent for "bestOdds". */
  value: number;
  /** For "bestOdds": the counts behind the share. */
  odds?: { bigPayRoles: number; openRoles: number };
}

/** The platform with the highest `value`, more open roles and then the name breaking ties; null when none has any. */
function leader<T extends { name: string; openRoles: number }>(items: readonly T[], value: (item: T) => number): T | null {
  const best = [...items]
    .filter((item) => value(item) > 0)
    .sort((a, b) => value(b) - value(a) || b.openRoles - a.openRoles || a.name.localeCompare(b.name));
  return best[0] ?? null;
}

/**
 * Today's top picks, the hero of the Best platforms page (owner's request, 23 November 2026): the
 * leader on each measure, so "best" always rests on the published figures. Before the first
 * job-search counts (TRD-11) only "most open roles" can be picked. A platform may lead on more than
 * one measure. `odds` is the bigPayOdds ranking, so the pick matches the Pay section.
 */
export function topPicks(platforms: readonly RacePlatform[], odds: readonly BigPayOdds[]): TopPick[] {
  const picks: TopPick[] = [];
  const mostOpen = leader(platforms, (p) => p.openRoles);
  if (mostOpen) picks.push({ kind: "mostOpen", slug: mostOpen.slug, name: mostOpen.name, value: mostOpen.openRoles });

  const counted = platforms.flatMap((p) => (p.stats ? [{ slug: p.slug, name: p.name, ...p.stats }] : []));
  const mostNew = leader(counted, (p) => p.newRoles);
  if (mostNew) picks.push({ kind: "mostNew", slug: mostNew.slug, name: mostNew.name, value: mostNew.newRoles });
  const mostBigPay = leader(counted, (p) => p.bigPayRoles);
  if (mostBigPay) picks.push({ kind: "mostBigPay", slug: mostBigPay.slug, name: mostBigPay.name, value: mostBigPay.bigPayRoles });

  const best = odds[0];
  if (best) {
    picks.push({
      kind: "bestOdds",
      slug: best.slug,
      name: best.name,
      value: best.sharePercent,
      odds: { bigPayRoles: best.bigPayRoles, openRoles: best.openRoles },
    });
  }
  return picks;
}
