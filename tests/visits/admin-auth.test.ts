// This Next.js version still names the matcher helper after Middleware, the old name for Proxy.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config as proxyConfig } from "../../src/proxy";
import { adminAccess, adminGate, type AdminSettings } from "../../src/visits/admin-auth";

const SETTINGS: AdminSettings = { user: "admin", password: "correct horse battery", passwordMinChars: 12 };
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("admin pages: sign-in (VIS-03, ADR 0008)", () => {
  it("lets in the right user name and password", () => {
    expect(adminAccess(basic("admin", "correct horse battery"), SETTINGS)).toBe("allowed");
    expect(adminGate(basic("admin", "correct horse battery"), SETTINGS)).toBeNull();
  });

  it.each([
    ["no sign-in", null],
    ["a wrong password", basic("admin", "wrong password!!")],
    ["a wrong user name", basic("root", "correct horse battery")],
    ["another scheme", "Bearer correct horse battery"],
  ])("asks the browser to sign in for %s", async (_case, authorization) => {
    const res = adminGate(authorization, SETTINGS);

    expect(res?.status).toBe(401);
    expect(res?.headers.get("www-authenticate")).toBe('Basic realm="Admin", charset="UTF-8"');
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  it.each([
    ["no password is set", undefined],
    ["the password is too short", "short-pass"],
    ["the password is blank", "               "],
  ])("acts as if the pages didn't exist while %s", (_case, password) => {
    const settings = { ...SETTINGS, password };

    // Not even an exact match gets in.
    expect(adminAccess(basic("admin", password ?? ""), settings)).toBe("off");
    expect(adminGate(null, settings)?.status).toBe(404);
  });

  it("guards every admin address and nothing else", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config: proxyConfig, url });
    expect(matches("/admin")).toBe(true);
    expect(matches("/admin/visits")).toBe(true);
    expect(matches("/admin/visits/export")).toBe(true);
    expect(matches("/")).toBe(false);
    expect(matches("/contact")).toBe(false);
    expect(matches("/api/visits")).toBe(false);
    expect(matches("/administrator")).toBe(false);
  });
});
