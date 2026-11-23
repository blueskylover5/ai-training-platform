import { describe, expect, it } from "vitest";
import { bigPayOdds, payHighlights, sectorShares, topPicks } from "../../src/trends/insights";
import type { PayRow, RacePlatform } from "../../src/trends/queries";

function platform(slug: string, name: string, openRoles: number, bigPayRoles: number | null): RacePlatform {
  return { slug, name, openRoles, stats: bigPayRoles === null ? null : { openRoles, newRoles: 0, bigPayRoles } };
}

function payRow(slug: string, label: string, median: number, rateSamples: number): PayRow {
  return { slug, label, currency: "USD", unit: "per hour", median, typicalLow: median / 2, typicalHigh: median * 2, rateSamples, platforms: 5 };
}

describe("sectorShares", () => {
  it("ranks sectors by open roles and gives each one's share of all open roles", () => {
    const sectors = sectorShares(
      [
        { slug: "coding", label: "Coding", openCount: 300 },
        { slug: "law", label: "Law", openCount: 600 },
        { slug: "art", label: "Art", openCount: 3 },
      ],
      1000,
    );
    expect(sectors.map((s) => [s.label, s.rank, s.sharePercent])).toEqual([
      ["Law", 1, 60],
      ["Coding", 2, 30],
      ["Art", 3, 0],
    ]);
  });

  it("copes with no open roles at all", () => {
    expect(sectorShares([{ slug: "a", label: "A", openCount: 0 }], 0)).toEqual([
      { slug: "a", label: "A", openRoles: 0, sharePercent: 0, rank: 1 },
    ]);
  });
});

describe("bigPayOdds (TRD-11)", () => {
  const platforms = [
    platform("big", "Bigco", 500, 50),
    platform("rich", "Richco", 100, 70),
    platform("tiny", "Tinyco", 10, 10), // too few roles to quote
    platform("none", "Noneco", 80, 0), // no big-pay roles at all
    platform("new", "Newco", 90, null), // not counted yet
  ];

  it("ranks platforms with enough roles by their share of big-pay roles", () => {
    expect(bigPayOdds(platforms, 20)).toEqual([
      { slug: "rich", name: "Richco", openRoles: 100, bigPayRoles: 70, sharePercent: 70 },
      { slug: "big", name: "Bigco", openRoles: 500, bigPayRoles: 50, sharePercent: 10 },
    ]);
  });

  it("breaks a tie in share by the larger count", () => {
    const odds = bigPayOdds([platform("a", "A", 100, 50), platform("b", "B", 200, 100)], 20);
    expect(odds.map((o) => o.name)).toEqual(["B", "A"]);
  });
});

describe("payHighlights", () => {
  const platforms = [platform("big", "Bigco", 500, 50), platform("rich", "Richco", 100, 70), platform("new", "Newco", 90, null)];

  it("adds up big-pay roles, finds the best-paid sector that may be shown, and the best odds", () => {
    const odds = bigPayOdds(platforms, 20);
    const rows = [payRow("law", "Law", 75, 500), payRow("rare", "Rare work", 200, 3), payRow("coding", "Coding", 60, 100)];
    expect(payHighlights(platforms, 100, rows, odds)).toEqual({
      bigPay: { roles: 120, openRoles: 600, sharePercent: 20, minHourlyUsd: 100 },
      // "Rare work" rests on too few rates to be shown (TRD-08).
      topSector: { labels: ["Law"], median: 75, currency: "USD" },
      bestOdds: odds[0],
    });
  });

  it("names every sector tied for the highest median, best-sampled first", () => {
    const rows = [payRow("red", "Red-teaming", 75, 60), payRow("law", "Law", 75, 500), payRow("coding", "Coding", 60, 100)];
    expect(payHighlights([], null, rows, []).topSector).toEqual({ labels: ["Law", "Red-teaming"], median: 75, currency: "USD" });
  });

  it("has nothing to say before the first counts", () => {
    expect(payHighlights([platform("new", "Newco", 90, null)], null, [], [])).toEqual({
      bigPay: null,
      topSector: null,
      bestOdds: null,
    });
  });
});

describe("topPicks: the Best platforms hero", () => {
  const counted = (slug: string, name: string, openRoles: number, newRoles: number, bigPayRoles: number): RacePlatform => ({
    slug,
    name,
    openRoles,
    stats: { openRoles, newRoles, bigPayRoles },
  });

  it("names the leader on open roles, new roles, big-pay roles and big-pay odds", () => {
    const platforms = [
      counted("inv", "Invisible", 533, 0, 5),
      counted("micro1", "micro1", 331, 46, 136),
      counted("prolific", "Prolific", 206, 82, 22),
      counted("remo", "RemoExperts", 32, 0, 22),
      counted("tiny", "Tiny", 3, 0, 3),
    ];
    const odds = bigPayOdds(platforms, 20);

    expect(topPicks(platforms, odds)).toEqual([
      { kind: "mostOpen", slug: "inv", name: "Invisible", value: 533 },
      { kind: "mostNew", slug: "prolific", name: "Prolific", value: 82 },
      { kind: "mostBigPay", slug: "micro1", name: "micro1", value: 136 },
      // Tiny's 100% rests on 3 roles, below the minimum, so it can't be picked.
      { kind: "bestOdds", slug: "remo", name: "RemoExperts", value: 69, odds: { bigPayRoles: 22, openRoles: 32 } },
    ]);
  });

  it("breaks ties by open roles, then by name", () => {
    const platforms = [counted("b", "Beta", 100, 10, 0), counted("a", "Alpha", 100, 10, 0), counted("c", "Gamma", 200, 10, 0)];
    expect(topPicks(platforms, []).map((p) => [p.kind, p.name])).toEqual([
      ["mostOpen", "Gamma"],
      ["mostNew", "Gamma"],
    ]);
    expect(topPicks(platforms.slice(0, 2), [])[0].name).toBe("Alpha");
  });

  it("picks only the most open roles before the first job-search counts, and nothing without data", () => {
    expect(topPicks([platform("inv", "Invisible", 533, null), platform("m", "Mercor", 230, null)], [])).toEqual([
      { kind: "mostOpen", slug: "inv", name: "Invisible", value: 533 },
    ]);
    expect(topPicks([], [])).toEqual([]);
  });
});
