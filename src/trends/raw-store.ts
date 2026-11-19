import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Db } from "../db/client";
import { trendRawFiles } from "../db/schema";

/** Keeps the raw copy of every downloaded data file (TRD-01). */
export interface RawStore {
  put(key: string, body: string): Promise<void>;
}

/** On disk, under one folder: for a server with a lasting disk. */
export class FsRawStore implements RawStore {
  constructor(private readonly rootDir: string) {}

  async put(key: string, body: string): Promise<void> {
    const path = join(this.rootDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, "utf8");
  }
}

/**
 * In the database, for hosting where files written by a function don't last, such as Vercel
 * (ADR 0007). Keys name the file's content (a hash), so storing the same key again changes nothing.
 */
export class DbRawStore implements RawStore {
  constructor(private readonly db: Db) {}

  async put(key: string, body: string): Promise<void> {
    await this.db.insert(trendRawFiles).values({ key, body }).onConflictDoNothing();
  }
}

export class MemoryRawStore implements RawStore {
  readonly files = new Map<string, string>();

  async put(key: string, body: string): Promise<void> {
    this.files.set(key, body);
  }
}
