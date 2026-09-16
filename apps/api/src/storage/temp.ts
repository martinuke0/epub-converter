import { mkdir, readdir, rm, stat, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';

const TEMP_ROOT = process.env.TEMP_DIR || join(process.cwd(), '.tmp');
const TTL = Number(process.env.TEMP_TTL_SECONDS || 3600);

export interface StoredJob {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: number;
  path: string;
}

const index = new Map<string, StoredJob>();

export async function ensureTemp(): Promise<void> {
  await mkdir(TEMP_ROOT, { recursive: true });
}

export async function storeResult(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<StoredJob> {
  await ensureTemp();
  const id = nanoid(16);
  const path = join(TEMP_ROOT, `${id}.bin`);
  await writeFile(path, buffer);
  const job: StoredJob = {
    id,
    filename,
    mimeType,
    createdAt: Date.now(),
    path,
  };
  index.set(id, job);
  return job;
}

export async function getResult(id: string): Promise<{
  job: StoredJob;
  buffer: Buffer;
} | null> {
  const job = index.get(id);
  if (!job) return null;
  if (Date.now() - job.createdAt > TTL * 1000) {
    await deleteResult(id);
    return null;
  }
  const buffer = await readFile(job.path);
  return { job, buffer };
}

export async function deleteResult(id: string): Promise<void> {
  const job = index.get(id);
  if (!job) return;
  index.delete(id);
  await rm(job.path, { force: true });
}

export function startCleanupLoop(): void {
  const tick = async () => {
    const now = Date.now();
    for (const [id, job] of index) {
      if (now - job.createdAt > TTL * 1000) {
        await deleteResult(id);
      }
    }
    // Also sweep orphan files
    try {
      await ensureTemp();
      const files = await readdir(TEMP_ROOT);
      for (const f of files) {
        const p = join(TEMP_ROOT, f);
        const s = await stat(p);
        if (now - s.mtimeMs > TTL * 1000) {
          await rm(p, { force: true, recursive: true });
        }
      }
    } catch {
      /* ignore */
    }
  };
  setInterval(tick, 60_000).unref();
}
