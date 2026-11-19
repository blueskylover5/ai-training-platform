import { createHash, timingSafeEqual } from "node:crypto";

/**
 * True when `given` is exactly `expected`. Compares fixed-length hashes, so how long the check takes
 * says nothing about the secret, not even its length. For secrets such as CRON_SECRET and ADMIN_PASSWORD.
 */
export function matchesSecret(given: string | null | undefined, expected: string): boolean {
  const a = createHash("sha256").update(given ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
