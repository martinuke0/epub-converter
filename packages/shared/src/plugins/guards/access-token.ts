import type { GuardPlugin } from '../types.js';

/**
 * Optional private mode: if env ACCESS_TOKEN is set, require matching
 * X-Access-Token header or ?token= query. Do not commit secrets.
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
    if (provided && provided === required) return { allow: true };
    return {
      allow: false,
      status: 401,
      code: 'unauthorized',
      error: 'Unauthorized — valid access token required',
    };
  },
  ui: { slot: 'none' },
};
