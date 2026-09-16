import type { ConversionOptions, FormatId } from '@epub/shared';

export interface HealthResponse {
  ok: boolean;
  converter: {
    ok: boolean;
    engine: string;
    version?: string;
    mode: string;
    detail?: string;
  };
  maxFileSizeMb: number;
}

export interface Capability {
  to: FormatId;
  enabled: boolean;
  reason?: string;
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

export async function convertFile(
  file: File,
  to: FormatId,
  from: FormatId,
  options: ConversionOptions,
  onProgress?: (pct: number) => void
): Promise<ConvertJobResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/convert');
    xhr.responseType = 'blob';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 40));
      }
    };

    xhr.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(40 + Math.round((e.loaded / e.total) * 60));
      } else if (onProgress) {
        onProgress(70);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const stubbed = xhr.getResponseHeader('X-Stubbed') === '1';
        const filename =
          xhr.getResponseHeader('X-Filename') ||
          parseFilename(xhr.getResponseHeader('Content-Disposition')) ||
          `converted.${to}`;
        onProgress?.(100);
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
            const json = JSON.parse(String(reader.result)) as { error?: string };
            reject(new Error(json.error || `Conversion failed (${xhr.status})`));
          } catch {
            reject(new Error(`Conversion failed (${xhr.status})`));
          }
        };
        reader.onerror = () => reject(new Error(`Conversion failed (${xhr.status})`));
        reader.readAsText(xhr.response);
      }
    };

    xhr.onerror = () => reject(new Error('Network error during conversion'));
    xhr.ontimeout = () => reject(new Error('Conversion timed out'));
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
