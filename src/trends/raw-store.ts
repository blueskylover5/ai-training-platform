import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/** Keeps the raw copy of every downloaded data file (TRD-01). An S3 implementation comes later. */
export interface RawStore {
  put(key: string, body: string): Promise<void>;
}

export class FsRawStore implements RawStore {
  constructor(private readonly rootDir: string) {}

  async put(key: string, body: string): Promise<void> {
    const path = join(this.rootDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, "utf8");
  }
}

export class MemoryRawStore implements RawStore {
  readonly files = new Map<string, string>();

  async put(key: string, body: string): Promise<void> {
    this.files.set(key, body);
  }
}
