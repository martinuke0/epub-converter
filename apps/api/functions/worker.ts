/**
 * Cloudflare Worker: static UI (ASSETS) + Calibre Cloudflare Container + R2 staging.
 *
 * Production flow:
 * 1. Accept multipart upload at /api/convert
 * 2. Optionally stage bytes in R2 (UPLOADS)
 * 3. POST file to Calibre container binding (fetch → container :8090/convert)
 * 4. Return converted bytes; delete R2 object
 *
 * Local `npm run dev` still uses docker-compose + Hono (unchanged).
 * Optional CONVERTER_URL remains as an external fallback if the binding is absent.
 */

import { Container, getContainer, getRandom } from '@cloudflare/containers';

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
  /** Optional external Calibre URL (Compose / custom host). Unused when container binding works. */
  CONVERTER_URL?: string;
  MAX_FILE_SIZE_MB?: string;
}

const MAX_DEFAULT = 80;

function hasContainer(env: Env): env is Env & {
  CALIBRE_CONVERTER: DurableObjectNamespace<CalibreConverter>;
} {
  return !!env.CALIBRE_CONVERTER;
}

/** Build a request aimed at the container process path (not the Worker /api path). */
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

      return Response.json({
        ok: true,
        runtime: 'cloudflare-worker',
        converter: {
          ok: converterOk,
          detail,
          engine,
          version,
          via: hasContainer(env)
            ? 'cloudflare-container'
            : env.CONVERTER_URL
              ? 'converter-url'
              : 'none',
        },
        r2: !!env.UPLOADS,
        assets: !!env.ASSETS,
      });
    }

    if (url.pathname === '/api/convert' && request.method === 'POST') {
      if (!hasContainer(env) && !env.CONVERTER_URL) {
        return Response.json(
          {
            error:
              'Calibre converter not configured. Deploy Cloudflare Containers (CALIBRE_CONVERTER) or set CONVERTER_URL.',
          },
          { status: 503 }
        );
      }

      const maxMb = Number(env.MAX_FILE_SIZE_MB || MAX_DEFAULT);
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return Response.json({ error: 'Missing file' }, { status: 400 });
      }
      if (file.size > maxMb * 1024 * 1024) {
        return Response.json({ error: `File exceeds ${maxMb}MB` }, { status: 413 });
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
          return Response.json(
            { error: 'Upstream conversion failed', detail: text.slice(0, 2000) },
            { status: 502 }
          );
        }

        return new Response(res.body, {
          headers: {
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Disposition':
              res.headers.get('Content-Disposition') || 'attachment',
          },
        });
      } finally {
        if (env.UPLOADS) {
          await env.UPLOADS.delete(key).catch(() => undefined);
        }
      }
    }

    // Non-/api requests: SPA assets (run_worker_first only covers /api/*).
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
