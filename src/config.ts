/**
 * Central configuration. Limits, thresholds and schedules live here, never inline in code (AGENTS.md).
 */

export const trendsConfig = {
  sources: {
    roles: "https://aitraining.jobs/roles.json",
    pay: "https://aitraining.jobs/pay.json",
  },
  /** Identifies us to the data source. Add a contact address once the product domain exists. */
  userAgent: process.env.TRENDS_USER_AGENT ?? "ai-training-platform-trends/0.1",
  fetchTimeoutMs: 30_000,
  fetchAttempts: 3,
  retryDelayMs: 30_000,
  /** TRD-02: hold publishing when total open roles moves more than this share from the previous snapshot. */
  maxTotalChangeRatio: 0.5,
  /** TRD-08: hide pay figures that rest on fewer rate samples than this. */
  minPaySamples: 10,
  /** TRD-09: show an out-of-date notice when the newest snapshot is older than this. */
  staleAfterHours: 26,
  /** TRD-04: credit shown with every chart, page, share image and export. */
  credit: {
    name: "AITraining.jobs open data",
    url: "https://aitraining.jobs/data",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
} as const;

export const storageConfig = {
  /** "pglite://memory", "pglite://<directory>" or a postgres:// connection string. */
  databaseUrl: process.env.DATABASE_URL ?? "pglite://.data/pglite",
  rawStorageDir: process.env.RAW_STORAGE_DIR ?? ".data/raw",
} as const;
