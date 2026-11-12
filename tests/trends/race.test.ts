import { describe, expect, it } from "vitest";
import type { PlatformRaceData } from "../../src/trends/queries";
import { buildRaces, ordinal, rankEntries, toBoard } from "../../src/trends/race";

const OPTIONS = { size: 3, minOpenRolesForShare: 20 };

function platform(slug: string, name: string, openRoles: number, newRoles: number, bigPayRoles: number) {
  return { slug, name, openRoles, stats: { openRoles, newRoles, bigPayRoles } };
}

function raceData(withStats = true): PlatformRaceData {
  const platforms = [
    platform("big", "Bigco", 500, 0, 5),
    platform("fast", "Fastco", 300, 80, 150),
    platform("rich", "Richco", 100, 20, 70),
    platform("zero", "Zeroco", 50, 0, 0),
    // Every role pays $100+, but too few roles to quote a share.
    platform("tiny", "Tinyco", 10, 5, 10),
  ];
  return {
    roles: { dataDate: "2026-11-12", fetchedAt: new Date("2026-11-12T03:00:00Z") },
    stats: withStats
      ? { dataDate: "2026-11-12", fetchedAt: new Date("2026-11-12T03:05:00Z"), newSince: "2026-11-06", bigPayMinHourlyUsd: 100 }
      : null,
    platforms: withStats ? platforms : platforms.map((p) => ({ ...p, stats: null })),
  };
}

const names = (entries: Array<{ name: string }>) => entries.map((e) => e.name);

describe("ordinal", () => {
  it("writes English ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th",
    ]);
  });
});

describe("rankEntries", () => {
  it("ranks most first, and tied platforms share a rank in name order", () => {
    const ranked = rankEntries([
      { slug: "c", name: "Cee", value: 3 },
      { slug: "b", name: "Bee", value: 5 },
      { slug: "a", name: "Ay", value: 5 },
    ]);
    expect(ranked.map((e) => [e.name, e.rank])).toEqual([
      ["Ay", 1],
      ["Bee", 1],
      ["Cee", 3],
    ]);
  });
});

describe("buildRaces (TRD-11)", () => {
  const [open, fresh, bigPay] = buildRaces(raceData(), OPTIONS);

  it("ranks open roles and comments on the leader and the top 3", () => {
    expect(names(open.entries)).toEqual(["Bigco", "Fastco", "Richco", "Zeroco", "Tinyco"]);
    expect(open.commentary).toEqual([
      "Bigco leads with 500 open roles, 200 ahead of Fastco.",
      "The top 3 hold 94% of all 960 open roles.",
    ]);
    expect(open.description).toContain("12 November 2026");
  });

  it("ranks new roles and names the biggest climber and the quiet platforms", () => {
    expect(fresh.question).toBe("Who listed the most new roles in the last 7 days?");
    expect(names(fresh.entries)).toEqual(["Fastco", "Richco", "Tinyco", "Bigco", "Zeroco"]);
    expect(fresh.commentary).toEqual([
      "Fastco is on fire with 80 new roles, 60 ahead of Richco.",
      "Biggest climber: Tinyco, from 5th for open roles to 3rd here.",
      "2 of 5 platforms listed nothing new.",
    ]);
  });

  it("ranks big-pay roles, quotes shares only for platforms with enough roles, and spots the plot twist", () => {
    expect(bigPay.unit).toBe("roles at $100+/h");
    expect(names(bigPay.entries)).toEqual(["Fastco", "Richco", "Tinyco", "Bigco", "Zeroco"]);
    expect(bigPay.commentary).toEqual([
      "Fastco takes the money lap with 150 roles at $100+, 80 ahead of Richco.",
      "Best odds: 70% of Richco's 100 open roles advertise $100+.",
      "Plot twist: Bigco, 1st for open roles, is only 4th here.",
    ]);
    // TRD-07: advertised pay, never earnings.
    expect(bigPay.description).toContain("not what people earn");
    expect(bigPay.entries[0].detail).toBe("50% of its 300 open roles");
  });

  it("calls a tie at the front a tie", () => {
    const data = raceData();
    data.platforms[1] = platform("fast", "Fastco", 500, 80, 150);
    const [tied] = buildRaces(data, OPTIONS);
    expect(tied.commentary[0]).toBe("Bigco and Fastco are neck and neck on 500 open roles.");
  });

  it("offers only the open-roles race before the first job-search counts", () => {
    const races = buildRaces(raceData(false), OPTIONS);
    expect(races.map((r) => [r.key, r.available])).toEqual([
      ["open", true],
      ["new", false],
      ["big-pay", false],
    ]);
    expect(races[1].unavailableNote).toBe("Starts after the next daily update.");
    expect(races[1].entries).toEqual([]);
  });
});

describe("toBoard", () => {
  it("gives a lane to every platform that runs in any race, and leaves out zeros", () => {
    const board = toBoard(buildRaces(raceData(), OPTIONS), 2);

    expect(board.lanes.map((l) => l.name)).toEqual(["Bigco", "Fastco", "Richco"]);
    const [open, fresh] = board.races;
    expect(open.entries.map((e) => [e.name, e.racing])).toEqual([
      ["Bigco", true],
      ["Fastco", true],
      ["Richco", false],
    ]);
    // Bigco listed nothing new, so it sits this race out.
    expect(fresh.entries.map((e) => [e.name, e.racing])).toEqual([
      ["Fastco", true],
      ["Richco", true],
      ["Bigco", false],
    ]);
  });

  it("lets every platform tied at the cut-off run", () => {
    const data = raceData();
    data.platforms[2] = platform("rich", "Richco", 300, 20, 70);
    const [open] = toBoard(buildRaces(data, OPTIONS), 2).races;
    expect(open.entries.filter((e) => e.racing).map((e) => [e.name, e.rank])).toEqual([
      ["Bigco", 1],
      ["Fastco", 2],
      ["Richco", 2],
    ]);
  });
});
