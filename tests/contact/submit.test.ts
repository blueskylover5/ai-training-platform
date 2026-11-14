import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { contactConfig } from "../../src/config";
import { hashAddress } from "../../src/contact/address";
import { submitContactMessage } from "../../src/contact/submit";
import type { Db, DbHandle } from "../../src/db/client";
import { contactMessages } from "../../src/db/schema";
import { createTestDb } from "../helpers";

const NOW = new Date("2026-11-13T10:00:00Z");
const ADDRESS = "203.0.113.7";
const SECRET = "test-secret";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  name: "  Sam  ",
  email: "sam@example.com",
  message: "I passed onboarding on two platforms but have had no projects for a month.",
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
const submit = (fields: Record<string, string>, now = NOW, address = ADDRESS) =>
  submitContactMessage(handle.db, form(fields), { address, now, hashSecret: SECRET });

describe("submitContactMessage (CON-01 to CON-04)", () => {
  it("stores a valid message with a hashed address, never the address", async () => {
    const result = await submit(valid);

    expect(result).toEqual({ status: "sent", name: "Sam", email: "sam@example.com" });
    const [row] = await stored();
    expect(row).toMatchObject({
      name: "Sam",
      email: "sam@example.com",
      message: valid.message,
      status: "new",
      createdAt: NOW,
      addressHash: hashAddress(ADDRESS, SECRET),
    });
    expect(JSON.stringify(row)).not.toContain(ADDRESS);
  });

  it("accepts just an email and a message, with no topic or confirmation (CON-02, #7)", async () => {
    const result = await submit({ email: valid.email, message: valid.message });

    expect(result).toEqual({ status: "sent", name: null, email: "sam@example.com" });
    const [row] = await stored();
    expect(row).toMatchObject({ name: null, email: "sam@example.com", message: valid.message });
    expect(row.topic).toBeNull();
    expect(row.policyConfirmedAt).toBeNull();
  });

  it("ignores a topic or confirmation sent by a page from before the change", async () => {
    expect((await submit({ ...valid, topic: "more-work", policy: "yes" })).status).toBe("sent");
    const [row] = await stored();
    expect(row.topic).toBeNull();
    expect(row.policyConfirmedAt).toBeNull();
  });

  it("stores an empty name as no name", async () => {
    await submit({ ...valid, name: "" });
    const [row] = await stored();
    expect(row.name).toBeNull();
  });

  it("explains each wrong field and keeps what was typed (AT-15)", async () => {
    const result = await submit({ ...valid, email: "not-an-email", message: "help" });

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(Object.keys(result.errors).sort()).toEqual(["email", "message"]);
    expect(result.errors.message).toContain(String(contactConfig.messageMinChars));
    expect(result.values).toEqual({ name: "Sam", email: "not-an-email", message: "help" });
    expect(await stored()).toEqual([]);
  });

  it("asks for the email address when it is missing (AT-15)", async () => {
    const result = await submit({ message: valid.message });

    expect(result.status === "invalid" && Object.keys(result.errors)).toEqual(["email"]);
    expect(await stored()).toEqual([]);
  });

  it("refuses a message over the length limit", async () => {
    const result = await submit({ ...valid, message: "x".repeat(contactConfig.messageMaxChars + 1) });
    expect(result.status === "invalid" && Object.keys(result.errors)).toEqual(["message"]);
  });

  it("counts a line break as one character, as the browser does (CON-02)", async () => {
    // Exactly the limit as the browser counts it (one per line break)...
    const asTyped = `${Array(10).fill("x".repeat(99)).join("\n")}x`;
    expect(asTyped).toHaveLength(contactConfig.messageMaxChars);
    // ...but forms send each line break as CRLF, which would push it over.
    const asSent = asTyped.replace(/\n/g, "\r\n");
    expect(asSent.length).toBeGreaterThan(contactConfig.messageMaxChars);

    const result = await submit({ ...valid, message: asSent });

    expect(result.status).toBe("sent");
    const [row] = await stored();
    expect(row.message).not.toContain("\r");
  });

  it("says sent but stores nothing when the hidden bot field is filled (CON-04, AT-16)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await submit({ ...valid, [contactConfig.honeypotField]: "https://spam.example" });

    expect(result.status).toBe("sent");
    expect(await stored()).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("ignores a field named like a profile field, which browsers might autofill", async () => {
    expect(contactConfig.honeypotField).not.toMatch(/website|url|name|email|phone|company|address/i);
    expect((await submit({ ...valid, website: "https://my-site.example" })).status).toBe("sent");
    expect(await stored()).toHaveLength(1);
  });

  it("limits messages per address per hour, and lets them through again an hour later (CON-04, AT-16)", async () => {
    for (let i = 0; i < contactConfig.maxPerAddressPerHour; i++) {
      expect((await submit(valid, new Date(NOW.getTime() + i * 60_000))).status).toBe("sent");
    }
    expect((await submit(valid, new Date(NOW.getTime() + 30 * 60_000))).status).toBe("limited");
    // Another address is not affected.
    expect((await submit(valid, new Date(NOW.getTime() + 30 * 60_000), "198.51.100.2")).status).toBe("sent");
    // Over an hour after the first ones.
    const later = new Date(NOW.getTime() + (61 + contactConfig.maxPerAddressPerHour) * 60_000);
    expect((await submit(valid, later)).status).toBe("sent");
  });

  it("keeps the limit when messages from one address arrive at the same moment (CON-04)", async () => {
    const attempts = contactConfig.maxPerAddressPerHour + 3;
    const results = await Promise.all(Array.from({ length: attempts }, () => submit(valid)));

    expect(results.filter((r) => r.status === "sent")).toHaveLength(contactConfig.maxPerAddressPerHour);
    expect(results.filter((r) => r.status === "limited")).toHaveLength(3);
    expect(await stored()).toHaveLength(contactConfig.maxPerAddressPerHour);
  });

  it("returns an error that keeps the typed values when the database fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = {
      transaction: async () => {
        throw new Error("connection refused");
      },
    } as unknown as Db;

    const result = await submitContactMessage(broken, form(valid), { address: ADDRESS, now: NOW, hashSecret: SECRET });

    expect(result).toMatchObject({ status: "error", values: { email: "sam@example.com", message: valid.message } });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
