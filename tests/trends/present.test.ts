import { describe, expect, it } from "vitest";
import { creditLine, dailySeries, isStale, publicPay } from "../../src/trends/present";

describe("creditLine (TRD-04, AT-03)", () => {
  it("credits AITraining.jobs with the licence and the data date", () => {
    expect(creditLine("2026-11-09")).toBe("Data: AITraining.jobs open data (CC BY 4.0), 9 November 2026");
  });
});

describe("dailySeries (TRD-03, AT-04)", () => {
  it("keeps missing days as gaps instead of filling them in", () => {
    const series = dailySeries(
      [
        { date: "2026-11-01", value: 4300 },
        { date: "2026-11-04", value: 4376 },
      ],
      "2026-11-01",
      "2026-11-04",
    );
    expect(series).toEqual([
      { date: "2026-11-01", value: 4300 },
      { date: "2026-11-02", value: null },
      { date: "2026-11-03", value: null },
      { date: "2026-11-04", value: 4376 },
    ]);
  });

  it("crosses month ends correctly", () => {
    const dates = dailySeries([], "2026-10-30", "2026-11-02").map((p) => p.date);
    expect(dates).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("publicPay (TRD-07, TRD-08, AT-05)", () => {
  const figure = { median: 75, typicalLow: 40, typicalHigh: 150, rateSamples: 1082 };

  it("labels shown pay as advertised", () => {
    expect(publicPay(figure)).toEqual({ visible: true, label: "Advertised hourly pay", ...figure });
  });

  it("hides pay resting on fewer than 10 rate samples", () => {
    expect(publicPay({ ...figure, rateSamples: 9 })).toMatchObject({ visible: false });
    expect(publicPay({ ...figure, rateSamples: 10 })).toMatchObject({ visible: true });
  });

  it("hides pay when the source gives none", () => {
    expect(publicPay({ median: null, typicalLow: null, typicalHigh: null, rateSamples: null })).toMatchObject({
      visible: false,
    });
  });
});

describe("isStale (TRD-09)", () => {
  const fetched = new Date("2026-11-09T06:00:00Z");

  it("is fresh within 26 hours", () => {
    expect(isStale(fetched, new Date("2026-11-10T08:00:00Z"))).toBe(false);
  });

  it("is stale after 26 hours", () => {
    expect(isStale(fetched, new Date("2026-11-10T08:00:01Z"))).toBe(true);
  });
});
