import { describe, expect, it } from "vitest";
import { payFileSchema, rolesFileSchema } from "../../src/trends/schema";
import { PAY_FIXTURE, readFixture, ROLES_FIXTURE } from "../helpers";

const roles = () => JSON.parse(readFixture(ROLES_FIXTURE));
const pay = () => JSON.parse(readFixture(PAY_FIXTURE));

describe("open-data schema (TRD-02)", () => {
  it("accepts the recorded roles.json", () => {
    const file = rolesFileSchema.parse(roles());
    expect(file.temporal_coverage).toBe("2026-11-09");
    expect(file.totals.open_roles).toBe(4376);
    expect(file.open_by_work_type).toHaveLength(12);
    expect(file.open_by_platform).toHaveLength(62);
    expect(file.recent_market_momentum.weekly).toHaveLength(11);
  });

  it("accepts the recorded pay.json", () => {
    const file = payFileSchema.parse(pay());
    expect(file.pay_by_work_type).toHaveLength(12);
  });

  it("accepts a kind of work without pay figures", () => {
    const file = roles();
    const first = file.open_by_work_type[0];
    for (const key of ["currency", "unit", "median", "typical_low", "typical_high", "rate_samples", "platforms"]) {
      delete first[key];
    }
    expect(rolesFileSchema.safeParse(file).success).toBe(true);
  });

  it("rejects a file with a missing required field", () => {
    const file = roles();
    delete file.totals.open_roles;
    expect(rolesFileSchema.safeParse(file).success).toBe(false);
  });

  it("rejects a file whose licence is no longer CC BY 4.0", () => {
    const file = pay();
    file.license = "https://example.com/all-rights-reserved";
    const result = payFileSchema.safeParse(file);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/CC BY 4\.0/);
  });

  it("rejects duplicate slugs", () => {
    const file = roles();
    file.open_by_platform.push({ ...file.open_by_platform[0] });
    expect(rolesFileSchema.safeParse(file).success).toBe(false);
  });
});
