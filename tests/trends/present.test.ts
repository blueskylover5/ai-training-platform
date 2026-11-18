import { describe, expect, it } from "vitest";
import {
  creditLine,
  dailySeries,
  formatChange,
  formatCount,
  formatMoney,
  formatShortDate,
  formatUpdateTime,
  isStale,
  niceScale,
  publicPay,
  updateCadence,
} from "../../src/trends/present";

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

  // Collected every 6 hours (ADR 0006), so 8 hours means a run was missed.
  it("is fresh within 8 hours", () => {
    expect(isStale(fetched, new Date("2026-11-09T14:00:00Z"))).toBe(false);
  });

  it("is stale after 8 hours", () => {
    expect(isStale(fetched, new Date("2026-11-09T14:00:01Z"))).toBe(true);
  });
});

describe("update time and cadence (TRD-01, ADR 0006)", () => {
  it("shows when the source built the figures, in UTC on a 24-hour clock", () => {
    expect(formatUpdateTime(new Date("2026-11-18T12:07:54.850Z"))).toBe("12:07 UTC");
    expect(formatUpdateTime(new Date("2026-11-18T00:05:00Z"))).toBe("00:05 UTC");
    expect(formatUpdateTime(new Date("2026-11-18T18:59:59Z"))).toBe("18:59 UTC");
  });

  it("describes the schedule in words", () => {
    expect(updateCadence()).toBe("every 6 hours");
    expect(updateCadence(24)).toBe("every day");
    expect(updateCadence(1)).toBe("every hour");
  });
});

describe("formatting for the overview page", () => {
  it("formats counts, money, short dates and changes", () => {
    expect(formatCount(4393)).toBe("4,393");
    expect(formatMoney(75, "USD")).toBe("$75");
    expect(formatMoney(12.5, "USD")).toBe("$12.50");
    expect(formatShortDate("2026-11-02")).toBe("2 Nov");
    expect(formatChange(4393, 4376)).toEqual({ text: "+17", direction: "up" });
    expect(formatChange(379, 388)).toEqual({ text: "−9", direction: "down" });
    expect(formatChange(62, 62)).toEqual({ text: "No change", direction: "flat" });
  });

  it("builds round axis scales that cover the largest value", () => {
    expect(niceScale(503, 3)).toEqual({ max: 600, ticks: [0, 200, 400, 600] });
    expect(niceScale(200, 4)).toEqual({ max: 200, ticks: [0, 50, 100, 150, 200] });
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    const { max, ticks } = niceScale(1611, 4);
    expect(max).toBeGreaterThanOrEqual(1611);
    expect(ticks.at(-1)).toBe(max);
  });
});
