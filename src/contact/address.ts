import { createHash } from "node:crypto";
import { contactConfig } from "../config";

/*
 * The sender's network address, for the per-hour limit only (CON-04). It is never stored:
 * only a hash mixed with a server secret is.
 */

/**
 * Picks the address the hosting proxy saw from a forwarded-address header such as
 * "visitor-typed, 198.51.100.7". The proxy appends its entry, so the trusted one is
 * `trustedProxyHops` from the end; entries a visitor adds themselves sit further left and are
 * ignored. Returns "unknown" when the header is missing or shorter than expected.
 */
export function clientAddress(headerValue: string | null | undefined, trustedProxyHops: number): string {
  const entries = (headerValue ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
  const hops = Number.isInteger(trustedProxyHops) && trustedProxyHops >= 1 ? trustedProxyHops : 1;
  return entries[entries.length - hops] ?? "unknown";
}

/**
 * The secret mixed into address hashes. In production it must be set (CONTACT_HASH_SECRET) and
 * long enough, because with a known value every IPv4 hash could be reversed by trying all
 * addresses. Elsewhere a fixed development value stands in.
 */
export function addressHashSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.CONTACT_HASH_SECRET?.trim() ?? "";
  const production = env.NODE_ENV === "production";
  if (secret !== "" && (!production || secret.length >= contactConfig.hashSecretMinChars)) return secret;
  if (production) {
    throw new Error(
      `CONTACT_HASH_SECRET must be set to at least ${contactConfig.hashSecretMinChars} characters in production (CON-04).`,
    );
  }
  return contactConfig.developmentHashSecret;
}

/** Salted hash of the sender's network address; the address itself is never stored. */
export function hashAddress(address: string, secret: string = addressHashSecret()): string {
  return createHash("sha256").update(`${secret}:${address}`).digest("hex");
}
