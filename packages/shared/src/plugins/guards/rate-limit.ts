import type { GuardContext, GuardPlugin } from '../types.js';

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_SEC = 60;

function parseIntEnv(env: GuardContext['env'], key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function incr(
  ctx: GuardContext,
  key: string,
  ttlSec: number
): Promise<number> {
  if (ctx.kv) {
    const cur = Number((await ctx.kv.get(key)) || '0') || 0;
    const next = cur + 1;
    await ctx.kv.put(key, String(next), { expirationTtl: Math.max(ttlSec, 60) });
    return next;
  }
  if (ctx.memory) {
    const entry = ctx.memory.get(key) as { count: number; expires: number } | undefined;
    const now = Date.now();
    if (!entry || entry.expires < now) {
      ctx.memory.set(key, { count: 1, expires: now + ttlSec * 1000 });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
  // No store — skip enforcement (misconfigured production should bind KV)
  return 0;
}

/** Per-IP convert rate limit (KV in production, memory locally). */
export const rateLimitGuard: GuardPlugin = {
  kind: 'guard',
  id: 'rate-limit',
  label: 'Per-IP rate limit',
  description: 'Limit converts per IP per time window',
  async check(ctx) {
    const limit = parseIntEnv(ctx.env, 'RATE_LIMIT_MAX', DEFAULT_LIMIT);
    const windowSec = parseIntEnv(ctx.env, 'RATE_LIMIT_WINDOW_SEC', DEFAULT_WINDOW_SEC);
    const bucket = Math.floor(Date.now() / (windowSec * 1000));
    const key = `rl:${ctx.ip}:${bucket}`;
    const count = await incr(ctx, key, windowSec * 2);
    if (count === 0) {
      // No backend — allow (local without memory still ok if caller injects memory)
      return { allow: true };
    }
    if (count > limit) {
      return {
        allow: false,
        status: 429,
        code: 'rate_limit',
        error: `Rate limit exceeded — max ${limit} conversions per ${windowSec}s`,
        retryAfterSec: windowSec,
      };
    }
    return { allow: true };
  },
  ui: { slot: 'none' },
};
