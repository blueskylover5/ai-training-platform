import { visitConfig } from "../config";
import { matchesSecret } from "../secret-match";

/*
 * The admin pages (VIS-03, ADR 0008) sit behind the browser's own sign-in box (HTTP Basic), with
 * the user name ADMIN_USER ("admin" by default) and the password ADMIN_PASSWORD. Until a long
 * enough password is set, they answer "not found", as if they didn't exist.
 */

export interface AdminSettings {
  user: string;
  password: string | undefined;
  passwordMinChars: number;
}

export function adminSettings(env: Record<string, string | undefined> = process.env): AdminSettings {
  return { user: visitConfig.admin.user, password: env.ADMIN_PASSWORD, passwordMinChars: visitConfig.admin.passwordMinChars };
}

export type AdminAccess = "allowed" | "sign-in" | "off";

export function adminAccess(authorization: string | null, settings: AdminSettings): AdminAccess {
  const password = settings.password ?? "";
  if (password.trim().length < settings.passwordMinChars) return "off";
  const expected = `Basic ${Buffer.from(`${settings.user}:${password}`, "utf8").toString("base64")}`;
  return matchesSecret(authorization, expected) ? "allowed" : "sign-in";
}

const privateHeaders = { "cache-control": "no-store", "x-robots-tag": "noindex" };

/** The answer for a request that may not see an admin page, or null when it may. */
export function adminGate(authorization: string | null, settings: AdminSettings): Response | null {
  switch (adminAccess(authorization, settings)) {
    case "allowed":
      return null;
    case "off":
      return new Response("Not found", { status: 404, headers: privateHeaders });
    case "sign-in":
      return new Response("Sign in to see this page.", {
        status: 401,
        headers: { ...privateHeaders, "www-authenticate": 'Basic realm="Admin", charset="UTF-8"' },
      });
  }
}
