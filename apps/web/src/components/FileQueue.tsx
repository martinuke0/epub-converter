import { FORMATS, type FormatId } from '@epub/shared';

export type JobStatus = 'queued' | 'converting' | 'done' | 'error';

export interface QueueItem {
  id: string;
  file: File;
  from: FormatId;
  to: FormatId;
  status: JobStatus;
  progress: number;
  error?: string;
  stubbed?: boolean;
  resultName?: string;
}

interface Props {
  items: QueueItem[];
  onRemove: (id: string) => void;
  onDownload: (id: string) => void;
  onToChange: (id: string, to: FormatId) => void;
  capabilitiesFor: (from: FormatId) => { to: FormatId; enabled: boolean; reason?: string }[];
  busy: boolean;
}

export function FileQueue({
  items,
  onRemove,
  onDownload,
  onToChange,
  capabilitiesFor,
  busy,
}: Props) {
  if (!items.length) return null;

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const caps = capabilitiesFor(item.from);
        return (
          <li
            key={item.id}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-ink)]">{item.file.name}</p>
                <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                  {FORMATS[item.from].label} · {(item.file.size / 1024).toFixed(1)} KB
                  {item.stubbed ? ' · stub output' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  disabled={busy || item.status === 'converting' || item.status === 'done'}
                  value={item.to}
                  onChange={(e) => onToChange(item.id, e.target.value as FormatId)}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1.5 text-sm"
                >
                  {caps.map((c) => (
                    <option key={c.to} value={c.to} disabled={!c.enabled} title={c.reason}>
                      {FORMATS[c.to].label}
                      {!c.enabled ? ` — ${c.reason}` : ''}
                    </option>
                  ))}
                </select>
                {item.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => onDownload(item.id)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Download
                  </button>
                )}
                <button
                  type="button"
                  disabled={item.status === 'converting'}
                  onClick={() => onRemove(item.id)}
                  className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            </div>

            {(item.status === 'converting' || item.status === 'queued') && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-[var(--color-ink-muted)]">
                  <span>{item.status === 'queued' ? 'Queued' : 'Converting…'}</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            )}

            {item.status === 'error' && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{item.error}</p>
            )}

            {item.status === 'done' && item.resultName && (
              <p className="mt-2 text-sm text-brand-700 dark:text-brand-300">
                Ready: {item.resultName}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
