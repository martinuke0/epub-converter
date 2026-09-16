import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_OPTIONS,
  detectFormat,
  getCapabilities,
  getDefaultOutput,
  type ConversionOptions,
  type FormatId,
} from '@epub/shared';
import { AdvancedOptions } from './components/AdvancedOptions';
import { DropZone } from './components/DropZone';
import { FileQueue, type QueueItem } from './components/FileQueue';
import { FormatPicker } from './components/FormatPicker';
import { StatusBanner } from './components/StatusBanner';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import {
  convertFile,
  downloadBlob,
  fetchHealth,
  type Capability,
  type HealthResponse,
} from './lib/api';

type ResultBlob = { blob: Blob; filename: string };

function uid() {
  return crypto.randomUUID();
}

export default function App() {
  const { theme, toggle } = useTheme();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [globalTo, setGlobalTo] = useState<FormatId>('pdf');
  const [options, setOptions] = useState<ConversionOptions>({ ...DEFAULT_OPTIONS });
  const [busy, setBusy] = useState(false);
  const results = useRef(new Map<string, ResultBlob>());

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const h = await fetchHealth();
      setHealth(h);
      setHealthError(null);
    } catch (e) {
      setHealth(null);
      setHealthError(e instanceof Error ? e.message : 'unreachable');
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    const t = setInterval(() => void refreshHealth(), 30_000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  const primaryFrom: FormatId | null = items[0]?.from ?? null;

  const capabilities: Capability[] = useMemo(() => {
    if (!primaryFrom) {
      return getCapabilities('epub').map((c) => ({
        ...c,
        enabled: c.to === 'pdf' || c.enabled,
      }));
    }
    return getCapabilities(primaryFrom);
  }, [primaryFrom]);

  useEffect(() => {
    if (!primaryFrom) return;
    const def = getDefaultOutput(primaryFrom);
    const caps = getCapabilities(primaryFrom);
    const ok = caps.find((c) => c.to === def)?.enabled;
    setGlobalTo(ok ? def : caps.find((c) => c.enabled)?.to || 'epub');
  }, [primaryFrom]);

  const onFiles = (files: File[]) => {
    const next: QueueItem[] = files.map((file) => {
      const from = detectFormat(file.name, file.type)!;
      const def = getDefaultOutput(from);
      const caps = getCapabilities(from);
      const to = caps.find((c) => c.to === def)?.enabled
        ? def
        : caps.find((c) => c.enabled)?.to || 'epub';
      return {
        id: uid(),
        file,
        from,
        to,
        status: 'queued',
        progress: 0,
      };
    });
    setItems((prev) => [...prev, ...next]);
    if (next[0]) {
      setGlobalTo(next[0].to);
    }
  };

  const applyGlobalFormat = (to: FormatId) => {
    setGlobalTo(to);
    setItems((prev) =>
      prev.map((item) => {
        const cap = getCapabilities(item.from).find((c) => c.to === to);
        if (!cap?.enabled || item.status === 'done' || item.status === 'converting') {
          return item;
        }
        return { ...item, to };
      })
    );
  };

  const runConvert = async () => {
    const pending = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!pending.length) return;
    setBusy(true);

    for (const item of pending) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? { ...x, status: 'converting', progress: 5, error: undefined }
            : x
        )
      );
      try {
        const result = await convertFile(
          item.file,
          item.to,
          item.from,
          options,
          (pct) => {
            setItems((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, progress: pct } : x))
            );
          }
        );
        results.current.set(item.id, { blob: result.blob, filename: result.filename });
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: 'done',
                  progress: 100,
                  stubbed: result.stubbed,
                  resultName: result.filename,
                }
              : x
          )
        );
        downloadBlob(result.blob, result.filename);
      } catch (e) {
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: 'error',
                  progress: 0,
                  error: e instanceof Error ? e.message : 'Failed',
                }
              : x
          )
        );
      }
    }

    setBusy(false);
    void refreshHealth();
  };

  const empty = items.length === 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">
              E
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Epub</h1>
          </div>
          <p className="mt-2 max-w-md text-balance text-[var(--color-ink-muted)]">
            Convert ebooks without the clutter.
          </p>
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <div className="mb-6">
        <StatusBanner health={health} loading={healthLoading} error={healthError} />
      </div>

      <main className="flex flex-1 flex-col gap-6">
        {empty ? (
          <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
            <DropZone onFiles={onFiles} />
            <div className="mt-8 grid gap-3 text-sm text-[var(--color-ink-muted)] sm:grid-cols-3">
              <EmptyTip title="Hero pair" body="EPUB ↔ PDF with Calibre-quality output." />
              <EmptyTip title="Smart formats" body="Only valid targets stay enabled for your file." />
              <EmptyTip title="Private by design" body="Temp files expire; nothing is kept after download." />
            </div>
          </section>
        ) : (
          <>
            <DropZone onFiles={onFiles} disabled={busy} />

            <FormatPicker
              value={globalTo}
              capabilities={capabilities}
              onChange={applyGlobalFormat}
              disabled={busy}
            />

            <AdvancedOptions
              value={options}
              onChange={setOptions}
              showPdf={globalTo === 'pdf' || items.some((i) => i.to === 'pdf')}
              disabled={busy}
            />

            <FileQueue
              items={items}
              busy={busy}
              capabilitiesFor={(from) => getCapabilities(from)}
              onRemove={(id) => {
                results.current.delete(id);
                setItems((prev) => prev.filter((x) => x.id !== id));
              }}
              onDownload={(id) => {
                const r = results.current.get(id);
                if (r) downloadBlob(r.blob, r.filename);
              }}
              onToChange={(id, to) => {
                setItems((prev) => prev.map((x) => (x.id === id ? { ...x, to } : x)));
              }}
            />

            <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-lg backdrop-blur">
              <p className="px-2 text-sm text-[var(--color-ink-muted)]">
                {items.filter((i) => i.status === 'queued' || i.status === 'error').length} ready ·{' '}
                {items.filter((i) => i.status === 'done').length} done
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    results.current.clear();
                    setItems([]);
                  }}
                  className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={
                    busy ||
                    !items.some((i) => i.status === 'queued' || i.status === 'error')
                  }
                  onClick={() => void runConvert()}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy ? 'Converting…' : 'Convert & download'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-10 border-t border-[var(--color-border)] pt-6 text-center text-xs text-[var(--color-ink-muted)]">
        Files are processed via your local Calibre sidecar (or configured CONVERTER_URL). Max{' '}
        {health?.maxFileSizeMb ?? 80}MB. Temp outputs auto-delete.
      </footer>
    </div>
  );
}

function EmptyTip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
      <p className="font-medium text-[var(--color-ink)]">{title}</p>
      <p className="mt-1">{body}</p>
    </div>
  );
}
