/**
 * Runs once when a server starts. In production, refuse to start without a proper
 * CONTACT_HASH_SECRET (CON-04), instead of storing address hashes anyone could reverse.
 * Skipped while building, so `next build` works without the secret.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { addressHashSecret } = await import("./contact/address");
  addressHashSecret();
}
