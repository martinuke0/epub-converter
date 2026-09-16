import type { GuardPlugin } from '../types.js';

// ponytail: XOR constant-time compare — avoids early-exit timing leak; length branch is acceptable (timingSafeEqual also requires equal length)
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

/**
 * Optional private mode: if env ACCESS_TOKEN is set, require it via
 * X-Access-Token header. Do not commit secrets.
 */
export const accessTokenGuard: GuardPlugin = {
  kind: 'guard',
  id: 'access-token',
  label: 'Access token',
  description: 'When ACCESS_TOKEN is set, require it on convert requests',
  check(ctx) {
    const required = ctx.env.ACCESS_TOKEN;
    if (!required) return { allow: true };
    const provided = ctx.accessToken?.trim() || '';
    if (provided && safeEqual(provided, required)) return { allow: true };
    return {
      allow: false,
      status: 401,
      code: 'unauthorized',
      error: 'Unauthorized — valid access token required',
    };
  },
  ui: { slot: 'none' },
};
