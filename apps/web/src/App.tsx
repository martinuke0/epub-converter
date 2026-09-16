import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_OPTIONS,
  applyPreset,
  detectFormat,
  getCapabilities,
  getDefaultOutput,
  type ConversionOptions,
  type FormatId,
  type PresetPlugin,
} from '@epub/shared';
import { AdvancedOptions } from './components/AdvancedOptions';
import { DropZone } from './components/DropZone';
import { FileQueue, type QueueItem } from './components/FileQueue';
import { FormatPicker } from './components/FormatPicker';
import { PresetPicker } from './components/PresetPicker';
import { StatusBanner } from './components/StatusBanner';
import {
  convertFile,
  downloadBlob,
  fetchHealth,
  type Capability,
  type ConvertStage,
  type HealthResponse,
} from './lib/api';

type ResultBlob = { blob: Blob; filename: string };

function uid() {
  return crypto.randomUUID();
}

function readAccessToken(): string | null {
  try {
    return sessionStorage.getItem('epub-access-token');
  } catch {
    return null;
  }
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [globalTo, setGlobalTo] = useState<FormatId>('pdf');
  const [options, setOptions] = useState<ConversionOptions>({ ...DEFAULT_OPTIONS });
  const [presetId, setPresetId] = useState<string | null>(null);
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
    const t = setInterval(() => void refreshHealth(), 15_000);
    return () => clearInterval(t);
  }, [refreshHealth]);

  const converterWarm = Boolean(health?.converter.ok);
  const warming = Boolean(health && !health.converter.ok) || Boolean(health?.warming);

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

  const onPresetSelect = (preset: PresetPlugin) => {
    setPresetId(preset.id);
    setOptions(applyPreset(preset.id, { ...DEFAULT_OPTIONS }));
  };

  const onPresetClear = () => {
    setPresetId(null);
    setOptions({ ...DEFAULT_OPTIONS });
  };

  const patchOptions = (next: ConversionOptions) => {
    setOptions(next);
    // User tweaked — keep preset id as “base” but that’s fine; still selected.
  };

  const runConvert = async () => {
    const pending = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (!pending.length) return;
    setBusy(true);

    const accessToken = readAccessToken();
    const needWarm = !converterWarm;

    for (const item of pending) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: 'converting',
                progress: 2,
                stage: (needWarm ? 'checking' : 'uploading') as ConvertStage,
                error: undefined,
              }
            : x
        )
      );
      try {
        const result = await convertFile(item.file, item.to, item.from, options, {
          accessToken,
          waitForWarm: needWarm,
          onProgress: (pct) => {
            setItems((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, progress: pct } : x))
            );
          },
          onStage: (stage) => {
            setItems((prev) =>
              prev.map((x) => (x.id === item.id ? { ...x, stage } : x))
            );
            if (stage === 'warming' || stage === 'checking') {
              void refreshHealth();
            }
          },
        });
        results.current.set(item.id, { blob: result.blob, filename: result.filename });
        setItems((prev) =>
          prev.map((x) =>
            x.id === item.id
              ? {
                  ...x,
                  status: 'done',
                  progress: 100,
                  stage: 'done',
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
                  stage: 'error',
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
  const convertDisabled =
    busy ||
    !items.some((i) => i.status === 'queued' || i.status === 'error');

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-3 py-6 sm:px-4 sm:py-12">
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-sm font-bold text-white">
            E
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Epub</h1>
        </div>
        <p className="mt-2 max-w-md text-balance text-[var(--color-ink-muted)]">
          Convert ebooks without the clutter.
        </p>
      </header>

      <div className="mb-6">
        <StatusBanner
          health={health}
          loading={healthLoading}
          error={healthError}
          warming={warming}
        />
      </div>

      <main className="flex flex-1 flex-col gap-4 sm:gap-6">
        {empty ? (
          <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-8">
            <DropZone onFiles={onFiles} />
            <div className="mt-6 grid gap-3 text-sm text-[var(--color-ink-muted)] sm:mt-8 sm:grid-cols-3">
              <EmptyTip title="Hero pair" body="EPUB ↔ PDF with clean, readable output." />
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

            <PresetPicker
              value={presetId}
              onSelect={onPresetSelect}
              onClear={onPresetClear}
              outputFormat={globalTo}
              disabled={busy}
            />

            <AdvancedOptions
              value={options}
              onChange={patchOptions}
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

            <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p className="px-1 text-sm text-[var(--color-ink-muted)] sm:px-2">
                {items.filter((i) => i.status === 'queued' || i.status === 'error').length} ready ·{' '}
                {items.filter((i) => i.status === 'done').length} done
                {warming ? ' · converter warming' : ''}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex">
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
                  disabled={convertDisabled}
                  onClick={() => void runConvert()}
                  className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy
                    ? warming
                      ? 'Warming…'
                      : 'Converting…'
                    : warming
                      ? 'Convert (will wait)'
                      : 'Convert & download'}
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="mt-8 border-t border-[var(--color-border)] pt-6 text-center text-xs text-[var(--color-ink-muted)] sm:mt-10">
        Files are processed ephemerally. Max {health?.maxFileSizeMb ?? 80}MB. Temp outputs
        auto-delete.
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
