import type { Converter, ConvertRequest, ConvertResult, ConverterHealth } from './types.js';
import { extFor, mimeFor } from './types.js';

/**
 * Calls a Calibre sidecar (Docker local or production CONVERTER_URL).
 */
export class HttpConverter implements Converter {
  readonly name = 'http-calibre';

  constructor(private readonly baseUrl: string) {}

  async health(): Promise<ConverterHealth> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return {
          ok: false,
          engine: 'calibre',
          mode: 'remote',
          detail: `HTTP ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        ok?: boolean;
        version?: string;
        error?: string;
      };
      return {
        ok: !!data.ok,
        engine: 'calibre',
        version: data.version,
        mode: this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')
          ? 'local'
          : 'remote',
        detail: data.error,
      };
    } catch (e) {
      return {
        ok: false,
        engine: 'calibre',
        mode: 'remote',
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async convert(req: ConvertRequest): Promise<ConvertResult> {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(req.buffer)], { type: mimeFor(req.from) });
    form.append('file', blob, req.filename);
    form.append('from', req.from);
    form.append('to', req.to);
    form.append('options', JSON.stringify(req.options));

    const res = await fetch(`${this.baseUrl}/convert`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(600_000),
    });

    if (!res.ok) {
      let detail = `Converter returned ${res.status}`;
      try {
        const err = (await res.json()) as { error?: string; detail?: string };
        detail = err.detail || err.error || detail;
      } catch {
        detail = (await res.text().catch(() => detail)) || detail;
      }
      throw new Error(detail);
    }

    const ab = await res.arrayBuffer();
    const jobId = res.headers.get('X-Job-Id') ?? undefined;
    const stem = req.filename.replace(/\.[^.]+$/, '');
    return {
      buffer: Buffer.from(ab),
      filename: `${stem}${extFor(req.to)}`,
      mimeType: mimeFor(req.to),
      jobId,
    };
  }
}
