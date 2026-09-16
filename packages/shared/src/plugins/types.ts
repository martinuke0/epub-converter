import type { FormatId } from '../formats.js';
import type { ConversionOptions } from '../options.js';

/** Optional UI discovery metadata so the web app can list plugins without hardcoding. */
export interface UiSlot {
  /** Where the UI should surface this plugin */
  slot: 'preset-picker' | 'format-picker' | 'status' | 'none';
  label?: string;
  description?: string;
  /** Lower = earlier in lists */
  order?: number;
}

export interface FormatPlugin {
  kind: 'format';
  id: FormatId;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  canInput: boolean;
  canOutput: boolean;
  notes?: string;
  /** Catalog-only until enabled */
  comingSoon?: boolean;
  ui?: UiSlot;
}

export interface PresetPlugin {
  kind: 'preset';
  id: string;
  label: string;
  description?: string;
  /** Output formats this preset targets (empty/undefined = any) */
  appliesTo?: FormatId[];
  /** Partial options merged onto defaults when selected */
  options: Partial<ConversionOptions>;
  ui?: UiSlot;
}

export type GuardCode =
  | 'rate_limit'
  | 'too_large'
  | 'concurrent_limit'
  | 'unauthorized'
  | 'blocked';

export type GuardDecision =
  | { allow: true }
  | {
      allow: false;
      status: 401 | 403 | 413 | 429;
      code: GuardCode;
      error: string;
      retryAfterSec?: number;
    };

/** Minimal KV interface (Workers KV or compatible). */
export interface GuardKv {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface GuardContext {
  ip: string;
  fileSize: number;
  maxFileSizeBytes: number;
  /** From X-Access-Token header or ?token= */
  accessToken?: string | null;
  /** Env vars (ACCESS_TOKEN, RATE_LIMIT_*, …) */
  env: Record<string, string | undefined>;
  /** Cloudflare Workers KV (production) */
  kv?: GuardKv;
  /** Process-local store (Hono / local only — not multi-isolate safe) */
  memory?: Map<string, unknown>;
}

export interface GuardPlugin {
  kind: 'guard';
  id: string;
  label: string;
  description?: string;
  check(ctx: GuardContext): Promise<GuardDecision> | GuardDecision;
  /** Release concurrency / cleanup after convert finishes */
  release?(ctx: GuardContext): Promise<void> | void;
  ui?: UiSlot;
}

export type Plugin = FormatPlugin | PresetPlugin | GuardPlugin;

export interface PluginRegistry<T extends { id: string }> {
  register(plugin: T): PluginRegistry<T>;
  get(id: string): T | undefined;
  list(): T[];
  has(id: string): boolean;
}
