/**
 * Runs once when a server starts, and must finish before it serves requests, so it only starts
 * timers. Skipped while building: `next build` needs neither of these.
 * - In production, refuse to start without a proper CONTACT_HASH_SECRET (CON-04), instead of
 *   storing address hashes anyone could reverse.
 * - Start the trend collection schedule (TRD-01, ADR 0006) unless TRENDS_SCHEDULE is "off".
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (process.env.NODE_ENV === "production") {
    const { addressHashSecret } = await import("./contact/address");
    addressHashSecret();
  }

  const { trendsConfig } = await import("./config");
  if (trendsConfig.schedule.inApp) {
    const { startServerTrendsSchedule } = await import("./trends/server-schedule");
    startServerTrendsSchedule();
  }
}
