import { createHash } from "node:crypto";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { trendsConfig } from "../config";
import type { Db } from "../db/client";
import {
  trendPay,
  trendPlatforms,
  trendSnapshots,
  trendTotals,
  trendWeekly,
  trendWorkTypes,
} from "../db/schema";
import type { FetchText } from "./fetch";
import type { RawStore } from "./raw-store";
import { payRows, rolesRows } from "./rows";
import {
  describeIssues,
  payFileSchema,
  rolesFileSchema,
  type PayFile,
  type RolesFile,
} from "./schema";

export type FileKind = "roles" | "pay";

export type CollectOutcome =
  | { kind: FileKind; status: "published"; dataDate: string; snapshotId: number }
  | { kind: FileKind; status: "held"; dataDate: string; snapshotId: number; reason: string }
  | { kind: FileKind; status: "skipped"; dataDate: string; reason: string }
  | { kind: FileKind; status: "rejected"; reason: string };

export interface CollectDeps {
  db: Db;
  fetchText: FetchText;
  rawStore: RawStore;
  /** Notifies the team. Called for every rejected or held file. */
  alert: (message: string) => void | Promise<void>;
  sources?: { roles: string; pay: string };
  maxTotalChangeRatio?: number;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

interface FileSpec<T extends { temporal_coverage: string; updated: string }> {
  kind: FileKind;
  url: string;
  schema: z.ZodType<T>;
  /** Returns a reason to hold the snapshot instead of publishing it, or null. */
  holdReason?: (file: T) => Promise<string | null>;
  insertRows: (tx: Tx, file: T, snapshotId: number, published: boolean) => Promise<void>;
}

/**
 * Downloads, validates and stores today's AITraining.jobs open data (TRD-01, TRD-02).
 * Safe to run any number of times: a date that is already stored is skipped.
 */
export async function collectTrends(deps: CollectDeps): Promise<CollectOutcome[]> {
  const sources = deps.sources ?? trendsConfig.sources;
  const maxRatio = deps.maxTotalChangeRatio ?? trendsConfig.maxTotalChangeRatio;

  const roles: FileSpec<RolesFile> = {
    kind: "roles",
    url: sources.roles,
    schema: rolesFileSchema,
    holdReason: (file) => totalsJumpReason(deps.db, file, maxRatio),
    insertRows: async (tx, file, snapshotId, published) => {
      const rows = rolesRows(file, snapshotId);
      await tx.insert(trendTotals).values(rows.totals);
      await tx.insert(trendWorkTypes).values(rows.workTypes);
      await tx.insert(trendPlatforms).values(rows.platforms);
      // Weekly figures are shared across snapshots, so only published files may update them.
      if (published && rows.weekly.length > 0) {
        await tx
          .insert(trendWeekly)
          .values(rows.weekly)
          .onConflictDoUpdate({
            target: trendWeekly.weekStart,
            set: {
              newRoles: sql`excluded.new_roles`,
              asOfDate: sql`excluded.as_of_date`,
              snapshotId: sql`excluded.snapshot_id`,
            },
            setWhere: sql`${trendWeekly.asOfDate} <= excluded.as_of_date`,
          });
      }
    },
  };

  const pay: FileSpec<PayFile> = {
    kind: "pay",
    url: sources.pay,
    schema: payFileSchema,
    insertRows: async (tx, file, snapshotId) => {
      await tx.insert(trendPay).values(payRows(file, snapshotId));
    },
  };

  return [await collectFile(deps, roles), await collectFile(deps, pay)];
}

async function collectFile<T extends { temporal_coverage: string; updated: string }>(
  deps: CollectDeps,
  spec: FileSpec<T>,
): Promise<CollectOutcome> {
  const reject = async (reason: string): Promise<CollectOutcome> => {
    await deps.alert(`[trends] ${spec.kind}.json rejected: ${reason}`);
    return { kind: spec.kind, status: "rejected", reason };
  };

  let text: string;
  try {
    text = await deps.fetchText(spec.url);
  } catch (error) {
    return reject(`download failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return reject("the file is not valid JSON");
  }

  const parsed = spec.schema.safeParse(json);
  if (!parsed.success) return reject(`schema check failed: ${describeIssues(parsed.error)}`);
  const file = parsed.data;
  const dataDate = file.temporal_coverage;

  const skipped: CollectOutcome = {
    kind: spec.kind,
    status: "skipped",
    dataDate,
    reason: "a snapshot for this date is already stored",
  };
  const existing = await deps.db
    .select({ id: trendSnapshots.id })
    .from(trendSnapshots)
    .where(and(eq(trendSnapshots.dataDate, dataDate), eq(trendSnapshots.fileKind, spec.kind)))
    .limit(1);
  if (existing.length > 0) return skipped;

  const holdReason = spec.holdReason ? await spec.holdReason(file) : null;
  const sha256 = createHash("sha256").update(text).digest("hex");
  const rawKey = `aitraining-jobs/${dataDate}/${spec.kind}-${sha256.slice(0, 12)}.json`;
  await deps.rawStore.put(rawKey, text);

  const snapshotId = await deps.db.transaction(async (tx) => {
    const inserted = await tx
      .insert(trendSnapshots)
      .values({
        dataDate,
        fileKind: spec.kind,
        sourceUrl: spec.url,
        sourceUpdatedAt: parseTimestamp(file.updated),
        rawKey,
        sha256,
        status: holdReason === null ? "published" : "held",
        holdReason,
      })
      .onConflictDoNothing()
      .returning({ id: trendSnapshots.id });
    const row = inserted[0];
    if (!row) return null; // another run stored this date first
    await spec.insertRows(tx, file, row.id, holdReason === null);
    return row.id;
  });

  if (snapshotId === null) return skipped;
  if (holdReason !== null) {
    await deps.alert(`[trends] ${spec.kind}.json for ${dataDate} held, not published: ${holdReason}`);
    return { kind: spec.kind, status: "held", dataDate, snapshotId, reason: holdReason };
  }
  return { kind: spec.kind, status: "published", dataDate, snapshotId };
}

/** TRD-02: a large jump in total open roles usually means a source problem, so hold for review. */
async function totalsJumpReason(db: Db, file: RolesFile, maxRatio: number): Promise<string | null> {
  const previous = await db
    .select({ dataDate: trendTotals.dataDate, openRoles: trendTotals.openRoles })
    .from(trendTotals)
    .innerJoin(trendSnapshots, eq(trendSnapshots.id, trendTotals.snapshotId))
    .where(and(eq(trendSnapshots.status, "published"), lt(trendTotals.dataDate, file.temporal_coverage)))
    .orderBy(desc(trendTotals.dataDate))
    .limit(1);
  const prev = previous[0];
  if (!prev || prev.openRoles === 0) return null;

  const current = file.totals.open_roles;
  const change = Math.abs(current - prev.openRoles) / prev.openRoles;
  if (change <= maxRatio) return null;
  return `total open roles changed ${Math.round(change * 100)}% since ${prev.dataDate} (${prev.openRoles} to ${current})`;
}

function parseTimestamp(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
