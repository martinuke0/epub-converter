/**
 * Cloudflare Worker: static UI (ASSETS) + Calibre Cloudflare Container + R2 staging.
 *
 * Production flow:
 * 1. GuardPlugins (access token, size, rate limit, concurrent) via RATE_LIMIT KV
 * 2. Accept multipart upload at /api/convert
 * 3. Optionally stage bytes in R2 (UPLOADS)
 * 4. POST file to Calibre container binding (fetch → container :8090/convert)
 * 5. Return converted bytes; delete R2 object; release concurrency guards
 *
 * Local `npm run dev` still uses docker-compose + Hono (unchanged).
 * Optional CONVERTER_URL remains as an external fallback if the binding is absent.
 */

import { Container, getContainer, getRandom } from '@cloudflare/containers';
import {
  MAX_FILE_SIZE_MB,
  listGuards,
  listUiPresets,
  releaseGuards,
  runGuards,
  type GuardContext,
  type GuardKv,
} from '@epub/shared';

/** Number of interchangeable Calibre instances (keep ≤ max_instances in wrangler.toml). */
const CONTAINER_POOL = 3;

/**
 * Durable Object + Container class for the Calibre converter image.
 * Must match [[containers]].class_name and the durable_objects binding.
 */
export class CalibreConverter extends Container {
  defaultPort = 8090;
  /** Keep warm through typical conversion bursts; sleeps after idle. */
  sleepAfter = '15m';
  /** Flask /health — used during start readiness. */
  pingEndpoint = 'localhost/health';
  /** Conversion is local; no outbound needed. */
  enableInternet = false;
  envVars = {
    CONVERTER_PORT: '8090',
    TEMP_DIR: '/tmp/epub-convert',
    TEMP_TTL_SECONDS: '3600',
    MAX_FILE_SIZE_MB: '80',
  };
}

export interface Env {
  UPLOADS?: R2Bucket;
  CALIBRE_CONVERTER?: DurableObjectNamespace<CalibreConverter>;
  ASSETS?: Fetcher;
  /** Workers KV for rate-limit / concurrency counters (create namespace once). */
  RATE_LIMIT?: KVNamespace;
  /** Optional external Calibre URL (Compose / custom host). Unused when container binding works. */
  CONVERTER_URL?: string;
  MAX_FILE_SIZE_MB?: string;
  /** If set, require X-Access-Token or ?token= (do not commit the value). */
  ACCESS_TOKEN?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW_SEC?: string;
  MAX_CONCURRENT_PER_IP?: string;
  MAX_CONCURRENT_GLOBAL?: string;
}

const MAX_DEFAULT = 80;

function hasContainer(env: Env): env is Env & {
  CALIBRE_CONVERTER: DurableObjectNamespace<CalibreConverter>;
} {
  return !!env.CALIBRE_CONVERTER;
}

function containerRequest(path: string, init?: RequestInit): Request {
  return new Request(`http://container${path}`, init);
}

async function fetchConverter(
  env: Env,
  path: string,
  init?: RequestInit
): Promise<Response> {
  if (hasContainer(env)) {
    const stub =
      path === '/health'
        ? getContainer(env.CALIBRE_CONVERTER)
        : await getRandom(env.CALIBRE_CONVERTER, CONTAINER_POOL);
    return stub.fetch(containerRequest(path, init));
  }

  if (env.CONVERTER_URL) {
    const base = env.CONVERTER_URL.replace(/\/$/, '');
    return fetch(`${base}${path}`, init);
  }

  throw new Error(
    'No Calibre converter configured. Deploy with CALIBRE_CONVERTER container binding, or set CONVERTER_URL.'
  );
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function readAccessToken(request: Request, url: URL): string | null {
  return (
    request.headers.get('x-access-token') || url.searchParams.get('token') || null
  );
}

function kvAdapter(ns: KVNamespace | undefined): GuardKv | undefined {
  if (!ns) return undefined;
  return {
    get: (key) => ns.get(key),
    put: (key, value, options) => ns.put(key, value, options),
    delete: (key) => ns.delete(key),
  };
}

function guardEnv(env: Env): Record<string, string | undefined> {
  return {
    ACCESS_TOKEN: env.ACCESS_TOKEN,
    RATE_LIMIT_MAX: env.RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_SEC: env.RATE_LIMIT_WINDOW_SEC,
    MAX_CONCURRENT_PER_IP: env.MAX_CONCURRENT_PER_IP,
    MAX_CONCURRENT_GLOBAL: env.MAX_CONCURRENT_GLOBAL,
    MAX_FILE_SIZE_MB: env.MAX_FILE_SIZE_MB,
  };
}

function jsonError(
  body: { error: string; code?: string; retryAfterSec?: number; detail?: string },
  status: number,
  retryAfterSec?: number
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (retryAfterSec != null) headers['Retry-After'] = String(retryAfterSec);
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      let converterOk = false;
      let detail = 'no converter binding or CONVERTER_URL';
      let engine: string | undefined;
      let version: string | undefined;

      try {
        const r = await fetchConverter(env, '/health', {
          signal: AbortSignal.timeout(60_000),
        });
        converterOk = r.ok;
        if (r.ok) {
          const body = (await r.json().catch(() => null)) as {
            engine?: string;
            version?: string;
            detail?: string;
          } | null;
          engine = body?.engine;
          version = body?.version;
          detail = 'reachable';
        } else {
          detail = `HTTP ${r.status}`;
        }
      } catch (e) {
        detail = e instanceof Error ? e.message : String(e);
      }

      const maxMb = Number(env.MAX_FILE_SIZE_MB || MAX_DEFAULT);
      return Response.json({
        ok: true,
        runtime: 'cloudflare-worker',
        converter: {
          ok: converterOk,
          detail,
          engine,
          version,
          mode: hasContainer(env)
            ? 'cloudflare-container'
            : env.CONVERTER_URL
              ? 'converter-url'
              : 'none',
          via: hasContainer(env)
            ? 'cloudflare-container'
            : env.CONVERTER_URL
              ? 'converter-url'
              : 'none',
        },
        maxFileSizeMb: maxMb,
        warming: !converterOk,
        r2: !!env.UPLOADS,
        kv: !!env.RATE_LIMIT,
        assets: !!env.ASSETS,
        privateMode: !!env.ACCESS_TOKEN,
      });
    }

    if (url.pathname === '/api/presets' && request.method === 'GET') {
      return Response.json({
        presets: listUiPresets().map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
          appliesTo: p.appliesTo,
          options: p.options,
          ui: p.ui,
        })),
      });
    }

    if (url.pathname === '/api/convert' && request.method === 'POST') {
      if (!hasContainer(env) && !env.CONVERTER_URL) {
        return jsonError(
          {
            error:
              'Calibre converter not configured. Deploy Cloudflare Containers (CALIBRE_CONVERTER) or set CONVERTER_URL.',
            code: 'converter_unavailable',
          },
          503
        );
      }

      const maxMb = Number(env.MAX_FILE_SIZE_MB || MAX_FILE_SIZE_MB || MAX_DEFAULT);
      const maxBytes = maxMb * 1024 * 1024;
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return jsonError({ error: 'Missing file' }, 400);
      }
      if (file.size === 0) {
        return jsonError({ error: 'Empty file' }, 400);
      }

      const guardCtx: GuardContext = {
        ip: clientIp(request),
        fileSize: file.size,
        maxFileSizeBytes: maxBytes,
        accessToken: readAccessToken(request, url),
        env: guardEnv(env),
        kv: kvAdapter(env.RATE_LIMIT),
      };

      // Without KV, rate/concurrent guards no-op on counters (access-token + size still work).
      // Prefer binding RATE_LIMIT in wrangler.toml for production.
      const { decision, acquired } = await runGuards(listGuards(), guardCtx);
      if (!decision.allow) {
        return jsonError(
          {
            error: decision.error,
            code: decision.code,
            ...(decision.retryAfterSec != null
              ? { retryAfterSec: decision.retryAfterSec }
              : {}),
          },
          decision.status,
          decision.retryAfterSec
        );
      }

      const key = `tmp/${crypto.randomUUID()}`;
      if (env.UPLOADS) {
        await env.UPLOADS.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || 'application/octet-stream' },
          customMetadata: { filename: file.name },
        });
      }

      try {
        const upstream = new FormData();
        upstream.append('file', file, file.name);
        const to = form.get('to');
        const from = form.get('from');
        const options = form.get('options');
        if (typeof to === 'string') upstream.append('to', to);
        if (typeof from === 'string') upstream.append('from', from);
        if (typeof options === 'string') upstream.append('options', options);

        const res = await fetchConverter(env, '/convert', {
          method: 'POST',
          body: upstream,
        });

        if (!res.ok) {
          const text = await res.text();
          // Propagate upstream 413 if present
          if (res.status === 413) {
            return jsonError(
              { error: `File exceeds ${maxMb}MB`, code: 'too_large', detail: text.slice(0, 500) },
              413
            );
          }
          return jsonError(
            { error: 'Upstream conversion failed', detail: text.slice(0, 2000) },
            502
          );
        }

        return new Response(res.body, {
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Disposition':
              res.headers.get('Content-Disposition') || 'attachment',
            'X-Filename':
              res.headers.get('X-Filename') ||
              file.name.replace(/\.[^.]+$/, '') + (typeof to === 'string' ? `.${to}` : ''),
          },
        });
      } finally {
        await releaseGuards(acquired, guardCtx);
        if (env.UPLOADS) {
          await env.UPLOADS.delete(key).catch(() => undefined);
        }
      }
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return jsonError({ error: 'Not found' }, 404);
  },
};
