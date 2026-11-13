import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contactConfig } from "../../src/config";
import { hashAddress, submitContactMessage } from "../../src/contact/submit";
import type { DbHandle } from "../../src/db/client";
import { contactMessages } from "../../src/db/schema";
import { createTestDb } from "../helpers";

const NOW = new Date("2026-11-13T10:00:00Z");
const ADDRESS = "203.0.113.7";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  name: "  Sam  ",
  email: "sam@example.com",
  topic: "more-work",
  message: "I passed onboarding on two platforms but have had no projects for a month.",
  policy: "yes",
};

let handle: DbHandle;

beforeAll(async () => {
  handle = await createTestDb();
}, 60_000);

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  await handle.db.execute(sql`TRUNCATE contact_messages RESTART IDENTITY`);
});

const stored = () => handle.db.select().from(contactMessages);

describe("submitContactMessage (CON-01 to CON-04)", () => {
  it("stores a valid message with the rules confirmation and a hashed address, never the address", async () => {
    const result = await submitContactMessage(handle.db, form(valid), { address: ADDRESS, now: NOW });

    expect(result).toEqual({ status: "sent", name: "Sam", email: "sam@example.com" });
    const [row] = await stored();
    expect(row).toMatchObject({
      name: "Sam",
      email: "sam@example.com",
      topic: "more-work",
      message: valid.message,
      status: "new",
      policyConfirmedAt: NOW,
      addressHash: hashAddress(ADDRESS),
    });
    expect(JSON.stringify(row)).not.toContain(ADDRESS);
  });

  it("stores an empty name as no name", async () => {
    await submitContactMessage(handle.db, form({ ...valid, name: "" }), { address: ADDRESS, now: NOW });
    const [row] = await stored();
    expect(row.name).toBeNull();
  });

  it("refuses a message without the platform-rules confirmation (CON-02)", async () => {
    const result = await submitContactMessage(handle.db, form({ ...valid, policy: "" }), { address: ADDRESS, now: NOW });

    expect(result.status).toBe("invalid");
    expect(result.status === "invalid" && Object.keys(result.errors)).toEqual(["policy"]);
    expect(await stored()).toEqual([]);
  });

  it("explains each wrong field and keeps what was typed", async () => {
    const result = await submitContactMessage(
      handle.db,
      form({ ...valid, email: "not-an-email", topic: "hack-my-account", message: "help" }),
      { address: ADDRESS, now: NOW },
    );

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(Object.keys(result.errors).sort()).toEqual(["email", "message", "topic"]);
    expect(result.errors.message).toContain(String(contactConfig.messageMinChars));
    expect(result.values).toMatchObject({ email: "not-an-email", message: "help", policy: true });
    expect(await stored()).toEqual([]);
  });

  it("refuses a message over the length limit", async () => {
    const result = await submitContactMessage(
      handle.db,
      form({ ...valid, message: "x".repeat(contactConfig.messageMaxChars + 1) }),
      { address: ADDRESS, now: NOW },
    );
    expect(result.status === "invalid" && Object.keys(result.errors)).toEqual(["message"]);
  });

  it("says sent but stores nothing when the hidden bot field is filled (CON-04)", async () => {
    const result = await submitContactMessage(handle.db, form({ ...valid, website: "https://spam.example" }), {
      address: ADDRESS,
      now: NOW,
    });

    expect(result.status).toBe("sent");
    expect(await stored()).toEqual([]);
  });

  it("limits messages per address per hour, and lets them through again an hour later (CON-04)", async () => {
    const send = (now: Date, address = ADDRESS) => submitContactMessage(handle.db, form(valid), { address, now });

    for (let i = 0; i < contactConfig.maxPerAddressPerHour; i++) {
      expect((await send(new Date(NOW.getTime() + i * 60_000))).status).toBe("sent");
    }
    expect((await send(new Date(NOW.getTime() + 30 * 60_000))).status).toBe("limited");
    // Another address is not affected.
    expect((await send(new Date(NOW.getTime() + 30 * 60_000), "198.51.100.2")).status).toBe("sent");
    // Over an hour after the first ones.
    expect((await send(new Date(NOW.getTime() + 61 * 60_000 + contactConfig.maxPerAddressPerHour * 60_000))).status).toBe(
      "sent",
    );
  });
});

describe("hashAddress", () => {
  it("depends on the secret and never contains the address", () => {
    expect(hashAddress(ADDRESS, "a")).not.toBe(hashAddress(ADDRESS, "b"));
    expect(hashAddress(ADDRESS, "a")).toMatch(/^[0-9a-f]{64}$/);
  });
});
