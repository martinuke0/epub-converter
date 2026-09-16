/**
 * Cloudflare Worker / Pages Function stub for production conversion path.
 *
 * Flow:
 * 1. Accept multipart upload
 * 2. Store in R2 (binding UPLOADS) with short TTL key
 * 3. POST to CONVERTER_URL (Calibre sidecar / future Cloudflare Container)
 * 4. Return converted bytes; delete R2 object
 *
 * This cannot run Calibre inside the Worker isolate.
 * Wire CONVERTER_URL via wrangler vars / dashboard secrets.
 */

export interface Env {
  UPLOADS: R2Bucket;
  CONVERTER_URL: string;
  MAX_FILE_SIZE_MB?: string;
}

const MAX_DEFAULT = 80;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      let converterOk = false;
      let detail = 'CONVERTER_URL not set';
      if (env.CONVERTER_URL) {
        try {
          const r = await fetch(`${env.CONVERTER_URL.replace(/\/$/, '')}/health`, {
            signal: AbortSignal.timeout(5000),
          });
          converterOk = r.ok;
          detail = converterOk ? 'reachable' : `HTTP ${r.status}`;
        } catch (e) {
          detail = e instanceof Error ? e.message : String(e);
        }
      }
      return Response.json({
        ok: true,
        runtime: 'cloudflare-worker',
        converter: { ok: converterOk, detail, urlConfigured: !!env.CONVERTER_URL },
        r2: !!env.UPLOADS,
      });
    }

    if (url.pathname === '/api/convert' && request.method === 'POST') {
      if (!env.CONVERTER_URL) {
        return Response.json(
          {
            error:
              'CONVERTER_URL not configured. Point it at your Calibre sidecar or Cloudflare Container.',
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
      // Optional R2 staging (useful for large files / async jobs)
      if (env.UPLOADS) {
        await env.UPLOADS.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type },
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

        const res = await fetch(`${env.CONVERTER_URL.replace(/\/$/, '')}/convert`, {
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

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
