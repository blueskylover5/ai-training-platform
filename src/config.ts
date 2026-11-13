/**
 * Central configuration. Limits, thresholds and schedules live here, never inline in code (AGENTS.md).
 */

export const siteConfig = {
  /** Working names until the product name is decided (spec §13). */
  name: "AI Training Opportunity & Expert Support Platform",
  shortName: "AI Training Platform",
  description: "Daily trends for AI training work: open roles, kinds of work, advertised pay and platforms. Free.",
} as const;

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
  /** Overview page: how many recent weeks the new-roles chart shows. */
  overviewWeeks: 12,
  /** Overview page: how many platforms the chart shows; the data table lists them all. */
  overviewTopPlatforms: 15,
  /**
   * TRD-11: per-platform counts read from the AITraining.jobs job search once a day, right after
   * roles.json. Only the `total` of each search is kept; individual roles are never stored.
   */
  platformStats: {
    searchUrl: "https://aitraining.jobs/api/v1/jobs",
    /** "New" means first listed in this many UTC days, ending on the data date (as roles.json counts it). */
    newWindowDays: 7,
    /** "Big pay" means the top of the advertised hourly range reaches this many US dollars. */
    bigPayMinHourlyUsd: 100,
    /** Pause between searches, to stay gentle on the source (3 searches per platform). */
    requestDelayMs: 500,
    /** Live search counts only match a roles file this many days old or newer (UTC). */
    maxLagDays: 1,
  },
  /** Platform race page. */
  race: {
    /** How many platforms run in each race; the data table lists them all. */
    size: 10,
    /** A platform needs this many open roles before its big-pay share is quoted. */
    minOpenRolesForShare: 20,
  },
  /** Platforms page, pay section: how many platforms the "best odds of $100+" chart shows. */
  bigPayOddsTop: 10,
  /** TRD-04: credit shown with every chart, page, share image and export. */
  credit: {
    name: "AITraining.jobs open data",
    url: "https://aitraining.jobs/data",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  },
} as const;

/**
 * Contact section on the Platforms page (CON-01 to CON-06, ADR 0005).
 * Messages are stored on the server and never shown on any public page.
 */
export const contactConfig = {
  /**
   * Public community links. Each button appears only once its link is set here.
   * Team or community channels only, never anyone's personal account (SEC-03).
   */
  telegramUrl: null as string | null,
  discordUrl: null as string | null,
  /** What visitors can pick in "Where are you stuck?". The first entry is the default. */
  topics: [
    { value: "choosing", label: "Choosing platforms" },
    { value: "getting-in", label: "Getting accepted" },
    { value: "more-work", label: "Getting more projects" },
    { value: "pay", label: "Pay and payouts" },
    { value: "my-field", label: "Work in my field" },
    { value: "other", label: "Something else" },
  ],
  nameMaxChars: 80,
  emailMaxChars: 254,
  messageMinChars: 20,
  messageMaxChars: 1000,
  /** CON-04: messages accepted from one network address per hour. */
  maxPerAddressPerHour: 3,
  /** Mixed into the stored hash of the sender's network address, so the address itself is never kept. */
  addressHashSecret: process.env.CONTACT_HASH_SECRET ?? "local-development-only",
} as const;

export const storageConfig = {
  /** "pglite://memory", "pglite://<directory>" or a postgres:// connection string. */
  databaseUrl: process.env.DATABASE_URL ?? "pglite://.data/pglite",
  rawStorageDir: process.env.RAW_STORAGE_DIR ?? ".data/raw",
} as const;
