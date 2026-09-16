import type { GuardContext, GuardPlugin } from '../types.js';

const DEFAULT_PER_IP = 2;
const DEFAULT_GLOBAL = 5;
const LEASE_TTL_SEC = 600;

function parseIntEnv(env: GuardContext['env'], key: string, fallback: number): number {
  const raw = env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

async function getCount(ctx: GuardContext, key: string): Promise<number> {
  if (ctx.kv) {
    return Number((await ctx.kv.get(key)) || '0') || 0;
  }
  if (ctx.memory) {
    const entry = ctx.memory.get(key) as { count: number } | undefined;
    return entry?.count ?? 0;
  }
  return 0;
}

async function setCount(ctx: GuardContext, key: string, count: number): Promise<void> {
  const next = Math.max(0, count);
  if (ctx.kv) {
    if (next === 0 && ctx.kv.delete) {
      await ctx.kv.delete(key);
    } else {
      await ctx.kv.put(key, String(next), { expirationTtl: LEASE_TTL_SEC });
    }
    return;
  }
  if (ctx.memory) {
    if (next === 0) ctx.memory.delete(key);
    else ctx.memory.set(key, { count: next });
  }
}

/** Max concurrent conversions (per-IP and global). Call release() when done. */
export const concurrentGuard: GuardPlugin = {
  kind: 'guard',
  id: 'concurrent',
  label: 'Concurrent conversion limit',
  description: 'Cap simultaneous converts per IP and globally',
  async check(ctx) {
    const perIp = parseIntEnv(ctx.env, 'MAX_CONCURRENT_PER_IP', DEFAULT_PER_IP);
    const global = parseIntEnv(ctx.env, 'MAX_CONCURRENT_GLOBAL', DEFAULT_GLOBAL);
    const ipKey = `conc:ip:${ctx.ip}`;
    const globalKey = 'conc:global';

    const ipCount = await getCount(ctx, ipKey);
    if (ipCount >= perIp) {
      return {
        allow: false,
        status: 429,
        code: 'concurrent_limit',
        error: `Too many concurrent conversions from your IP (max ${perIp})`,
        retryAfterSec: 30,
      };
    }
    const globalCount = await getCount(ctx, globalKey);
    if (globalCount >= global) {
      return {
        allow: false,
        status: 429,
        code: 'concurrent_limit',
        error: `Server busy — max ${global} concurrent conversions`,
        retryAfterSec: 30,
      };
    }

    await setCount(ctx, ipKey, ipCount + 1);
    await setCount(ctx, globalKey, globalCount + 1);
    return { allow: true };
  },
  async release(ctx) {
    const ipKey = `conc:ip:${ctx.ip}`;
    const globalKey = 'conc:global';
    const ipCount = await getCount(ctx, ipKey);
    const globalCount = await getCount(ctx, globalKey);
    await setCount(ctx, ipKey, ipCount - 1);
    await setCount(ctx, globalKey, globalCount - 1);
  },
  ui: { slot: 'none' },
};
