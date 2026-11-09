import {
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** One downloaded data file per data date and kind (TRD-01). */
export const trendSnapshots = pgTable(
  "trend_snapshots",
  {
    id: serial("id").primaryKey(),
    dataDate: date("data_date").notNull(),
    fileKind: text("file_kind", { enum: ["roles", "pay"] }).notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    rawKey: text("raw_key").notNull(),
    sha256: text("sha256").notNull(),
    status: text("status", { enum: ["published", "held"] }).notNull(),
    holdReason: text("hold_reason"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("trend_snapshots_date_kind_uq").on(t.dataDate, t.fileKind)],
);

const snapshotRef = () =>
  integer("snapshot_id")
    .notNull()
    .references(() => trendSnapshots.id, { onDelete: "cascade" });

export const trendTotals = pgTable("trend_totals", {
  snapshotId: snapshotRef().primaryKey(),
  dataDate: date("data_date").notNull(),
  openRoles: integer("open_roles").notNull(),
  platformsLive: integer("platforms_live").notNull(),
  newLast7d: integer("new_last_7d").notNull(),
});

/** Open roles by kind of work from roles.json; pay columns are empty where the source gives none. */
export const trendWorkTypes = pgTable(
  "trend_work_types",
  {
    snapshotId: snapshotRef(),
    dataDate: date("data_date").notNull(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    openCount: integer("open_count").notNull(),
    currency: text("currency"),
    unit: text("unit"),
    median: doublePrecision("median"),
    typicalLow: doublePrecision("typical_low"),
    typicalHigh: doublePrecision("typical_high"),
    rateSamples: integer("rate_samples"),
    platforms: integer("platforms"),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.slug] }),
    index("trend_work_types_slug_date_idx").on(t.slug, t.dataDate),
  ],
);

/** Advertised hourly pay by kind of work from pay.json. */
export const trendPay = pgTable(
  "trend_pay",
  {
    snapshotId: snapshotRef(),
    dataDate: date("data_date").notNull(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    currency: text("currency").notNull(),
    unit: text("unit").notNull(),
    median: doublePrecision("median").notNull(),
    typicalLow: doublePrecision("typical_low").notNull(),
    typicalHigh: doublePrecision("typical_high").notNull(),
    rateSamples: integer("rate_samples").notNull(),
    platforms: integer("platforms").notNull(),
    openTotal: integer("open_total"),
    unpriced: integer("unpriced"),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.slug] }),
    index("trend_pay_slug_date_idx").on(t.slug, t.dataDate),
  ],
);

export const trendPlatforms = pgTable(
  "trend_platforms",
  {
    snapshotId: snapshotRef(),
    dataDate: date("data_date").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    openCount: integer("open_count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.snapshotId, t.slug] }),
    index("trend_platforms_slug_date_idx").on(t.slug, t.dataDate),
  ],
);

/** New roles per ISO week. A newer published file updates a week's value (ADR 0003). */
export const trendWeekly = pgTable("trend_weekly", {
  weekStart: date("week_start").primaryKey(),
  newRoles: integer("new_roles").notNull(),
  asOfDate: date("as_of_date").notNull(),
  snapshotId: snapshotRef(),
});
