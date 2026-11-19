import type { NextRequest } from "next/server";
import { adminGate, adminSettings } from "./visits/admin-auth";

/**
 * Guards the admin pages (VIS-03, ADR 0008): the browser asks for the admin user name and password
 * before any of them runs. The pages check again themselves, in case this ever stops matching.
 */
export function proxy(request: NextRequest) {
  return adminGate(request.headers.get("authorization"), adminSettings()) ?? undefined;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
