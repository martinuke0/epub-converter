import type { ConversionOptions, FormatId } from '@epub/shared';

export type ConvertStage =
  | 'checking'
  | 'warming'
  | 'uploading'
  | 'converting'
  | 'downloading'
  | 'done'
  | 'error';

export interface HealthResponse {
  ok: boolean;
  converter: {
    ok: boolean;
    engine?: string;
    version?: string;
    mode?: string;
    detail?: string;
    via?: string;
  };
  maxFileSizeMb: number;
  warming?: boolean;
  privateMode?: boolean;
}

export interface Capability {
  to: FormatId;
  enabled: boolean;
  reason?: string;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSec?: number;

  constructor(
    message: string,
    opts: { status: number; code?: string; retryAfterSec?: number }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfterSec = opts.retryAfterSec;
  }
}

function friendlyError(status: number, code?: string, fallback?: string): string {
  if (code === 'rate_limit' || status === 429) {
    return fallback || 'Too many conversions — please wait a moment and try again.';
  }
  if (code === 'concurrent_limit') {
    return fallback || 'Too many conversions in progress — try again shortly.';
  }
  if (code === 'too_large' || status === 413) {
    return fallback || 'File is too large for conversion.';
  }
  if (code === 'unauthorized' || status === 401) {
    return fallback || 'Unauthorized — an access token is required.';
  }
  return fallback || `Conversion failed (${status})`;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('API unreachable');
  return res.json();
}

export async function fetchCapabilities(from: FormatId): Promise<Capability[]> {
  const res = await fetch(`/api/capabilities/${from}`);
  if (!res.ok) throw new Error('Failed to load capabilities');
  const data = (await res.json()) as { capabilities: Capability[] };
  return data.capabilities;
}

export interface ConvertJobResult {
  blob: Blob;
  filename: string;
  stubbed: boolean;
  jobId?: string;
}

export interface ConvertCallbacks {
  onProgress?: (pct: number) => void;
  onStage?: (stage: ConvertStage) => void;
  /** Optional ACCESS_TOKEN for private mode */
  accessToken?: string | null;
  /** If true, poll health until converter is warm before uploading */
  waitForWarm?: boolean;
}

async function waitUntilWarm(
  onStage?: (stage: ConvertStage) => void,
  maxMs = 120_000
): Promise<void> {
  const start = Date.now();
  onStage?.('warming');
  while (Date.now() - start < maxMs) {
    try {
      const h = await fetchHealth();
      if (h.converter.ok) return;
    } catch {
      // keep trying
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function convertFile(
  file: File,
  to: FormatId,
  from: FormatId,
  options: ConversionOptions,
  callbacks?: ConvertCallbacks | ((pct: number) => void)
): Promise<ConvertJobResult> {
  const cb: ConvertCallbacks =
    typeof callbacks === 'function' ? { onProgress: callbacks } : callbacks || {};

  if (cb.waitForWarm) {
    cb.onStage?.('checking');
    await waitUntilWarm(cb.onStage);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/convert');
    xhr.responseType = 'blob';
    if (cb.accessToken) {
      xhr.setRequestHeader('X-Access-Token', cb.accessToken);
    }

    cb.onStage?.('uploading');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && cb.onProgress) {
        cb.onProgress(Math.round((e.loaded / e.total) * 35));
      }
    };

    xhr.upload.onload = () => {
      cb.onStage?.('converting');
      cb.onProgress?.(40);
    };

    xhr.onprogress = (e) => {
      cb.onStage?.('downloading');
      if (e.lengthComputable && cb.onProgress) {
        cb.onProgress(40 + Math.round((e.loaded / e.total) * 55));
      } else if (cb.onProgress) {
        cb.onProgress(70);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const stubbed = xhr.getResponseHeader('X-Stubbed') === '1';
        const filename =
          xhr.getResponseHeader('X-Filename') ||
          parseFilename(xhr.getResponseHeader('Content-Disposition')) ||
          `converted.${to}`;
        cb.onStage?.('done');
        cb.onProgress?.(100);
        resolve({
          blob: xhr.response as Blob,
          filename,
          stubbed,
          jobId: xhr.getResponseHeader('X-Job-Id') ?? undefined,
        });
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const json = JSON.parse(String(reader.result)) as {
              error?: string;
              code?: string;
              retryAfterSec?: number;
            };
            const msg = friendlyError(xhr.status, json.code, json.error);
            cb.onStage?.('error');
            reject(
              new ApiError(msg, {
                status: xhr.status,
                code: json.code,
                retryAfterSec: json.retryAfterSec,
              })
            );
          } catch {
            cb.onStage?.('error');
            reject(
              new ApiError(friendlyError(xhr.status), { status: xhr.status })
            );
          }
        };
        reader.onerror = () => {
          cb.onStage?.('error');
          reject(new ApiError(friendlyError(xhr.status), { status: xhr.status }));
        };
        reader.readAsText(xhr.response);
      }
    };

    xhr.onerror = () => {
      cb.onStage?.('error');
      reject(new Error('Network error during conversion'));
    };
    xhr.ontimeout = () => {
      cb.onStage?.('error');
      reject(new Error('Conversion timed out'));
    };
    xhr.timeout = 600_000;

    const form = new FormData();
    form.append('file', file);
    form.append('to', to);
    form.append('from', from);
    form.append('options', JSON.stringify(options));
    xhr.send(form);
  });
}

function parseFilename(cd: string | null): string | null {
  if (!cd) return null;
  const m = /filename\*?=(?:UTF-8'')?["']?([^"';]+)/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : null;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function stageLabel(stage?: ConvertStage): string {
  switch (stage) {
    case 'checking':
      return 'Checking…';
    case 'warming':
      return 'Warming converter…';
    case 'uploading':
      return 'Uploading…';
    case 'converting':
      return 'Converting…';
    case 'downloading':
      return 'Downloading…';
    case 'done':
      return 'Done';
    case 'error':
      return 'Error';
    default:
      return 'Working…';
  }
}
