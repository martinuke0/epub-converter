import {
  MAX_FILE_SIZE_BYTES,
  listGuards,
  releaseGuards,
  runGuards,
  type GuardContext,
  type GuardPlugin,
} from '@epub/shared';

/** Process-local counters — OK for single-process Hono, NOT for multi-isolate Workers. */
const localMemory = new Map<string, unknown>();

export function clientIp(headers: Headers, fallback = '127.0.0.1'): string {
  const cf = headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return fallback;
}

export function readAccessToken(req: {
  header: (name: string) => string | undefined;
  query: (name: string) => string | undefined;
}): string | null {
  return req.header('x-access-token') || req.query('token') || null;
}

export function guardEnvFromProcess(): Record<string, string | undefined> {
  return {
    ACCESS_TOKEN: process.env.ACCESS_TOKEN,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SEC: process.env.RATE_LIMIT_WINDOW_SEC,
    MAX_CONCURRENT_PER_IP: process.env.MAX_CONCURRENT_PER_IP,
    MAX_CONCURRENT_GLOBAL: process.env.MAX_CONCURRENT_GLOBAL,
    MAX_FILE_SIZE_MB: process.env.MAX_FILE_SIZE_MB,
  };
}

export function buildGuardContext(partial: {
  ip: string;
  fileSize: number;
  accessToken?: string | null;
  maxFileSizeBytes?: number;
  kv?: GuardContext['kv'];
  memory?: Map<string, unknown>;
  env?: Record<string, string | undefined>;
}): GuardContext {
  return {
    ip: partial.ip || 'unknown',
    fileSize: partial.fileSize,
    maxFileSizeBytes: partial.maxFileSizeBytes ?? MAX_FILE_SIZE_BYTES,
    accessToken: partial.accessToken,
    env: partial.env ?? guardEnvFromProcess(),
    kv: partial.kv,
    memory: partial.memory ?? localMemory,
  };
}

export async function enforceGuards(ctx: GuardContext): Promise<{
  ok: true;
  acquired: GuardPlugin[];
} | {
  ok: false;
  status: 401 | 403 | 413 | 429;
  body: {
    error: string;
    code: string;
    retryAfterSec?: number;
  };
}> {
  const { decision, acquired } = await runGuards(listGuards(), ctx);
  if (!decision.allow) {
    return {
      ok: false,
      status: decision.status,
      body: {
        error: decision.error,
        code: decision.code,
        ...(decision.retryAfterSec != null
          ? { retryAfterSec: decision.retryAfterSec }
          : {}),
      },
    };
  }
  return { ok: true, acquired };
}

export { releaseGuards, localMemory };
