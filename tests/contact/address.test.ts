import { describe, expect, it } from "vitest";
import { contactConfig } from "../../src/config";
import { addressHashSecret, clientAddress, hashAddress } from "../../src/contact/address";

describe("clientAddress (CON-04)", () => {
  it("takes the entry our proxy appended, never one the visitor sent", () => {
    // The visitor sends a made-up header; the proxy appends the address it really saw.
    expect(clientAddress("1.2.3.4", 1)).toBe("1.2.3.4");
    expect(clientAddress("6.6.6.6, 203.0.113.7", 1)).toBe("203.0.113.7");
    expect(clientAddress("6.6.6.6, 7.7.7.7, 203.0.113.7", 1)).toBe("203.0.113.7");
  });

  it("counts back past each trusted proxy", () => {
    // Visitor's fake, the address the first proxy saw, then the second proxy's own hop.
    expect(clientAddress("6.6.6.6, 203.0.113.7, 10.0.0.2", 2)).toBe("203.0.113.7");
  });

  it("gives every made-up header from one address the same answer", () => {
    const seen = new Set(["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4", "5.5.5.5"].map((fake) => clientAddress(`${fake}, 203.0.113.7`, 1)));
    expect([...seen]).toEqual(["203.0.113.7"]);
  });

  it("says unknown when the header is missing or too short", () => {
    expect(clientAddress(null, 1)).toBe("unknown");
    expect(clientAddress("", 1)).toBe("unknown");
    expect(clientAddress(" , ", 1)).toBe("unknown");
    expect(clientAddress("203.0.113.7", 2)).toBe("unknown");
  });

  it("treats a nonsense hop count as one proxy", () => {
    expect(clientAddress("6.6.6.6, 203.0.113.7", 0)).toBe("203.0.113.7");
    expect(clientAddress("6.6.6.6, 203.0.113.7", Number.NaN)).toBe("203.0.113.7");
  });
});

describe("addressHashSecret (CON-04)", () => {
  const long = "x".repeat(contactConfig.hashSecretMinChars);

  it("uses the configured secret", () => {
    expect(addressHashSecret({ CONTACT_HASH_SECRET: long, NODE_ENV: "production" })).toBe(long);
    expect(addressHashSecret({ CONTACT_HASH_SECRET: "short", NODE_ENV: "development" })).toBe("short");
  });

  it("refuses to run in production without a long enough secret", () => {
    expect(() => addressHashSecret({ NODE_ENV: "production" })).toThrow(/CONTACT_HASH_SECRET/);
    expect(() => addressHashSecret({ CONTACT_HASH_SECRET: "   ", NODE_ENV: "production" })).toThrow(/CONTACT_HASH_SECRET/);
    expect(() => addressHashSecret({ CONTACT_HASH_SECRET: "short", NODE_ENV: "production" })).toThrow(/at least/);
  });

  it("uses the development value only outside production", () => {
    expect(addressHashSecret({ NODE_ENV: "development" })).toBe(contactConfig.developmentHashSecret);
    expect(addressHashSecret({ NODE_ENV: "test", CONTACT_HASH_SECRET: "" })).toBe(contactConfig.developmentHashSecret);
  });
});

describe("hashAddress", () => {
  it("depends on the secret and never contains the address", () => {
    expect(hashAddress("203.0.113.7", "a")).not.toBe(hashAddress("203.0.113.7", "b"));
    expect(hashAddress("203.0.113.7", "a")).toMatch(/^[0-9a-f]{64}$/);
  });
});
