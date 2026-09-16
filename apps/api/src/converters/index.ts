import { HttpConverter } from './http-converter.js';
import { StubConverter } from './stub-converter.js';
import type { Converter } from './types.js';

export * from './types.js';
export { HttpConverter } from './http-converter.js';
export { StubConverter } from './stub-converter.js';

/**
 * Pluggable converter factory.
 * - Prefer CONVERTER_URL (Docker Calibre or production sidecar)
 * - If health fails and ALLOW_STUB=true, fall back to stub (dev only)
 */
export function createConverter(): Converter {
  const url = process.env.CONVERTER_URL || 'http://localhost:8090';
  return new HttpConverter(url.replace(/\/$/, ''));
}

export function createStub(): Converter {
  return new StubConverter();
}
