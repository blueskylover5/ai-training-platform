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
/** Downloaded files plus the per-platform counts we put together from the job search (TRD-11). */
export type SnapshotKind = FileKind | "platform_stats";

export type CollectOutcome =
  | { kind: SnapshotKind; status: "published"; dataDate: string; snapshotId: number }
  /** A newer file or newer counts replaced the ones published earlier for the same date (TRD-01). */
  | { kind: SnapshotKind; status: "updated"; dataDate: string; snapshotId: number }
  | { kind: SnapshotKind; status: "held"; dataDate: string; snapshotId: number; reason: string }
  | { kind: SnapshotKind; status: "skipped"; dataDate: string; reason: string }
  | { kind: SnapshotKind; status: "rejected"; reason: string };

export interface CollectDeps {
  db: Db;
  fetchText: FetchText;
  rawStore: RawStore;
  /** Notifies the team. Called for every rejected or held file. */
  alert: (message: string) => void | Promise<void>;
  sources?: { roles: string; pay: string };
  maxTotalChangeRatio?: number;
}

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

interface FileSpec<T extends { temporal_coverage: string; updated: string }> {
  kind: FileKind;
  url: string;
  schema: z.ZodType<T>;
  /** Returns a reason to hold the snapshot instead of publishing it, or null. */
  holdReason?: (file: T) => Promise<string | null>;
  insertRows: (tx: Tx, file: T, snapshotId: number, published: boolean) => Promise<void>;
  /** Removes a snapshot's own rows before a newer file for its date replaces them. */
  deleteRows: (tx: Tx, snapshotId: number) => Promise<void>;
}

/**
 * Downloads, validates and stores the AITraining.jobs open data (TRD-01, TRD-02). Runs every few
 * hours (ADR 0006): the source rebuilds its files hourly, and each date keeps one snapshot holding
 * the newest file seen for it. Safe to run any number of times: an unchanged file changes nothing.
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
    // The weekly figures are shared and stay: the newer file's upsert above refreshes them.
    deleteRows: async (tx, snapshotId) => {
      await tx.delete(trendTotals).where(eq(trendTotals.snapshotId, snapshotId));
      await tx.delete(trendWorkTypes).where(eq(trendWorkTypes.snapshotId, snapshotId));
      await tx.delete(trendPlatforms).where(eq(trendPlatforms.snapshotId, snapshotId));
    },
  };

  const pay: FileSpec<PayFile> = {
    kind: "pay",
    url: sources.pay,
    schema: payFileSchema,
    insertRows: async (tx, file, snapshotId) => {
      await tx.insert(trendPay).values(payRows(file, snapshotId));
    },
    deleteRows: async (tx, snapshotId) => {
      await tx.delete(trendPay).where(eq(trendPay.snapshotId, snapshotId));
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
  const sourceUpdatedAt = parseTimestamp(file.updated);
  const sha256 = createHash("sha256").update(text).digest("hex");
  const skip = (reason: string): CollectOutcome => ({ kind: spec.kind, status: "skipped", dataDate, reason });

  // TRD-01: one snapshot per date. A later run on that date replaces it, but only with a newer file.
  const [stored] = await storedSnapshot(deps.db, dataDate, spec.kind);
  const notNewer = stored ? notNewerReason(stored, sha256, sourceUpdatedAt) : null;
  if (notNewer) return skip(notNewer);

  const holdReason = spec.holdReason ? await spec.holdReason(file) : null;
  const status = holdReason === null ? "published" : "held";
  const rawKey = `aitraining-jobs/${dataDate}/${spec.kind}-${sha256.slice(0, 12)}.json`;
  await deps.rawStore.put(rawKey, text);

  const fields = { sourceUrl: spec.url, sourceUpdatedAt, rawKey, sha256, status, holdReason } as const;
  const result = await deps.db.transaction(async (tx): Promise<{ id: number; replaced: boolean } | { skip: string }> => {
    // Locks the date's snapshot, so two runs at once replace it one after the other.
    const [current] = await storedSnapshot(tx, dataDate, spec.kind, { lock: true });
    if (!current) {
      const inserted = await tx
        .insert(trendSnapshots)
        .values({ dataDate, fileKind: spec.kind, ...fields })
        .onConflictDoNothing()
        .returning({ id: trendSnapshots.id });
      const row = inserted[0];
      if (!row) return { skip: "another run stored this date at the same time" };
      await spec.insertRows(tx, file, row.id, status === "published");
      return { id: row.id, replaced: false };
    }
    // Another run may have stored a file for this date since the check above.
    const lateReason = notNewerReason(current, sha256, sourceUpdatedAt);
    if (lateReason) return { skip: lateReason };
    // TRD-02: a newer file that fails the checks never replaces figures already published.
    if (current.status === "published" && holdReason !== null) {
      return { skip: `a newer file was held (${holdReason}); the figures published earlier for this date stay` };
    }
    await spec.deleteRows(tx, current.id);
    await tx
      .update(trendSnapshots)
      .set({ ...fields, fetchedAt: sql`now()` })
      .where(eq(trendSnapshots.id, current.id));
    await spec.insertRows(tx, file, current.id, status === "published");
    return { id: current.id, replaced: true };
  });

  if ("skip" in result) {
    if (holdReason !== null) {
      await deps.alert(`[trends] newer ${spec.kind}.json for ${dataDate} held, not published: ${holdReason}`);
    }
    return skip(result.skip);
  }
  if (holdReason !== null) {
    await deps.alert(`[trends] ${spec.kind}.json for ${dataDate} held, not published: ${holdReason}`);
    return { kind: spec.kind, status: "held", dataDate, snapshotId: result.id, reason: holdReason };
  }
  return { kind: spec.kind, status: result.replaced ? "updated" : "published", dataDate, snapshotId: result.id };
}

/** The snapshot stored for a date and kind, if any. `lock` holds it until the transaction ends. */
export function storedSnapshot(db: Db | Tx, dataDate: string, kind: SnapshotKind, options: { lock?: boolean } = {}) {
  const query = db
    .select({
      id: trendSnapshots.id,
      sha256: trendSnapshots.sha256,
      sourceUpdatedAt: trendSnapshots.sourceUpdatedAt,
      status: trendSnapshots.status,
      fetchedAt: trendSnapshots.fetchedAt,
    })
    .from(trendSnapshots)
    .where(and(eq(trendSnapshots.dataDate, dataDate), eq(trendSnapshots.fileKind, kind)))
    .limit(1);
  return options.lock ? query.for("update") : query;
}

/** Why a downloaded file must not replace the one stored for its date, or null when it is newer. */
function notNewerReason(
  stored: { sha256: string; sourceUpdatedAt: Date | null },
  sha256: string,
  sourceUpdatedAt: Date | null,
): string | null {
  if (stored.sha256 === sha256) return "this file is already stored";
  if (stored.sourceUpdatedAt && sourceUpdatedAt && sourceUpdatedAt.getTime() <= stored.sourceUpdatedAt.getTime()) {
    return "the file stored for this date is as new or newer";
  }
  return null;
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
