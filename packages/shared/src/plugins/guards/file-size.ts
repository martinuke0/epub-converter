import type { GuardPlugin } from '../types.js';

/** Enforce MAX_FILE_SIZE_MB / maxFileSizeBytes. */
export const fileSizeGuard: GuardPlugin = {
  kind: 'guard',
  id: 'file-size',
  label: 'File size limit',
  description: 'Reject uploads over the configured max size',
  check(ctx) {
    if (ctx.fileSize > ctx.maxFileSizeBytes) {
      const mb = Math.round(ctx.maxFileSizeBytes / (1024 * 1024));
      return {
        allow: false,
        status: 413,
        code: 'too_large',
        error: `File exceeds ${mb}MB limit`,
      };
    }
    return { allow: true };
  },
  ui: { slot: 'none' },
};
