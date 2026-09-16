import type { GuardPlugin } from '../types.js';
import { accessTokenGuard } from './access-token.js';
import { concurrentGuard } from './concurrent.js';
import { fileSizeGuard } from './file-size.js';
import { rateLimitGuard } from './rate-limit.js';

export {
  accessTokenGuard,
  concurrentGuard,
  fileSizeGuard,
  rateLimitGuard,
};

/** Order matters: auth → size → rate → concurrency. */
export const builtinGuardPlugins: GuardPlugin[] = [
  accessTokenGuard,
  fileSizeGuard,
  rateLimitGuard,
  concurrentGuard,
];
