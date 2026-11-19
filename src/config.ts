/**
 * Central configuration. Limits, thresholds and schedules live here, never inline in code (AGENTS.md).
 */

export const siteConfig = {
  /** The product name, decided by the owner on 19 November 2026 (§13). "ATRE" is also the logo. */
  name: "AI Training Resolution Expert",
  shortName: "ATRE",
  description:
    "Stuck on an AI training project? ATRE helps you get past rejected tasks, failed assessments and hard prompts, and back to earning. Plus live figures on AI training work.",
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
  /**
   * TRD-01 (ADR 0006): when the collection runs. AITraining.jobs rebuilds its files a few minutes
   * past every hour, so we read them every `everyHours` hours, `minuteUtc` minutes past the hour,
   * counting from midnight UTC: with 6 and 30, at 00:30, 06:30, 12:30 and 18:30 UTC.
   */
  schedule: {
    everyHours: 6,
    minuteUtc: 30,
    /**
     * The app server runs the schedule itself, except on Vercel, where nothing runs between requests
     * and a Vercel Schedule calls `endpoint.path` instead (ADR 0007). TRENDS_SCHEDULE=on or off
     * overrides: off when something else runs the collection (a cron job), or on all but one server
     * when several run.
     */
    inApp: process.env.TRENDS_SCHEDULE ? process.env.TRENDS_SCHEDULE !== "off" : !process.env.VERCEL,
    /** After a start that missed a run, wait this long before catching up, so the server settles first. */
    catchUpDelayMs: 30_000,
  },
  /**
   * ADR 0007: the address a timer calls to run one collection (POST or GET), with the header
   * "Authorization: Bearer <CRON_SECRET>". On Vercel, the schedule in vercel.json calls it at the
   * times above. Without a secret of at least `secretMinChars` characters the address is switched off.
   */
  endpoint: {
    path: "/api/trends/collect",
    secretMinChars: 16,
  },
  /** TRD-09: show an out-of-date notice when the newest snapshot is older than this: one missed run plus some slack. */
  staleAfterHours: 8,
  /** Overview page: how many recent weeks the new-roles chart shows. */
  overviewWeeks: 12,
  /** Overview page: how many platforms the chart shows; the data table lists them all. */
  overviewTopPlatforms: 15,
  /**
   * TRD-11: per-platform counts read from the AITraining.jobs job search on every collection run,
   * right after roles.json. Only the `total` of each search is kept; individual roles are never stored.
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
    /**
     * Counts younger than this are not redone, so restarts and manual runs between scheduled runs
     * don't repeat the searches. Below `schedule.everyHours`, so every scheduled run counts afresh.
     */
    minHoursBetweenCounts: 5,
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
 * The Contact us page, /contact (CON-01 to CON-06, ADR 0005).
 * Messages are stored on the server, emailed to the team, and never shown on any public page.
 */
export const contactConfig = {
  /**
   * CON-05: the "Prefer to chat?" channels. Each appears only once it is set here. They should be
   * team or community channels (SEC-03). Exception approved by the owner on 14 November 2026 (#3):
   * until the team has its own channels, these are personal accounts. Swap them here then.
   */
  telegramUrl: "https://t.me/happyman01110" as string | null,
  discord: {
    /** Discord has no link that opens a chat from a username, so the section shows it with a copy button. */
    username: "sina2949" as string | null,
    /** Numeric Discord user ID. Once set, the username also links to the profile (discord.com/users/<id>). */
    userId: null as string | null,
  },
  nameMaxChars: 80,
  emailMaxChars: 254,
  messageMinChars: 20,
  messageMaxChars: 1000,
  /** CON-04: messages accepted from one network address per hour. */
  maxPerAddressPerHour: 3,
  /**
   * CON-04: where the sender's network address comes from. A hosting proxy appends the address it
   * saw to this header, so we read the entry `trustedProxyHops` from the end; anything the visitor
   * sent in the header themselves sits further left and is never used. Depends on the host: one
   * proxy in front of the app (Vercel, nginx, a load balancer) is 1.
   */
  address: {
    header: process.env.CONTACT_ADDRESS_HEADER ?? "x-forwarded-for",
    trustedProxyHops: Number(process.env.CONTACT_TRUSTED_PROXY_HOPS ?? "1") || 1,
  },
  /**
   * CON-04: the stored address hash mixes in CONTACT_HASH_SECRET. Production refuses to start
   * without one at least this long; elsewhere a fixed development value stands in.
   */
  hashSecretMinChars: 32,
  developmentHashSecret: "local-development-only",
  /** CON-04: the hidden anti-bot field. A name and label browsers and password managers don't autofill. */
  honeypotField: "leave_this_empty",
  /**
   * CON-03 (ADR 0005, amended 19 November 2026): each stored message is also emailed to the team
   * through Resend. Off until RESEND_API_KEY and CONTACT_NOTIFY_TO are both set. Until Resend has a
   * verified domain of ours, it sends only from onboarding@resend.dev, and only to the address the
   * Resend account was opened with.
   */
  email: {
    apiUrl: "https://api.resend.com/emails",
    to: process.env.CONTACT_NOTIFY_TO?.trim() || null,
    from: process.env.CONTACT_NOTIFY_FROM?.trim() || "ATRE <onboarding@resend.dev>",
    subjectMaxChars: 80,
    timeoutMs: 10_000,
  },
} as const;

export const storageConfig = {
  /** "pglite://memory", "pglite://<directory>" or a postgres:// connection string. */
  databaseUrl: process.env.DATABASE_URL ?? "pglite://.data/pglite",
  /**
   * For migrations: a direct connection when the host offers one beside a pooled DATABASE_URL
   * (the Neon integration on Vercel sets DATABASE_URL_UNPOOLED).
   */
  migrationDatabaseUrl: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "pglite://.data/pglite",
  /**
   * TRD-01: where raw copies of downloaded files go. "files" keeps them under `rawStorageDir`;
   * "database" keeps them in the trend_raw_files table, for hosting whose disk doesn't last, such as
   * Vercel, where it is the default (ADR 0007).
   */
  rawStorage: (process.env.RAW_STORAGE ?? (process.env.VERCEL ? "database" : "files")) === "database" ? "database" : "files",
  rawStorageDir: process.env.RAW_STORAGE_DIR ?? ".data/raw",
} as const;

/**
 * The visitor log (VIS-01 to VIS-04, ADR 0008). The owner decided on 19 November 2026 to record each
 * page view with the visitor's IP address and keep the records without a time limit. The footer
 * notice went with the footer the same day (VIS-02). The records are shown only on the admin page, behind ADMIN_PASSWORD.
 */
export const visitConfig = {
  /** Where each page reports its view. */
  endpointPath: "/api/visits",
  pathMaxChars: 300,
  referrerMaxChars: 500,
  userAgentMaxChars: 400,
  /** Longest request body accepted, in characters. */
  bodyMaxChars: 2_000,
  /** VIS-04: at most this many records per IP address per minute; more are dropped. */
  maxPerAddressPerMinute: 30,
  /** Headers Vercel adds with the approximate location of the visitor's IP address. City is URL-encoded. */
  locationHeaders: {
    country: "x-vercel-ip-country",
    region: "x-vercel-ip-country-region",
    city: "x-vercel-ip-city",
  },
  /** VIS-03: the admin pages. Off (not found) until ADMIN_PASSWORD has at least `passwordMinChars` characters. */
  admin: {
    user: process.env.ADMIN_USER?.trim() || "admin",
    passwordMinChars: 12,
    /** Visits per page in the list on /admin/visits. */
    pageSize: 100,
    /** How many pages and countries the summary lists. */
    topCount: 10,
  },
} as const;

/** The home page (19 November 2026). Its words and images are in src/content/landing.ts. */
export const landingConfig = {
  /**
   * How long each hero background photo shows before fading into the next. Visitors who ask for
   * less motion see the first photo only.
   */
  heroBackgroundIntervalMs: 7_000,
} as const;
