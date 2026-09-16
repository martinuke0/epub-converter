import type { HealthResponse } from '../lib/api';

interface Props {
  health: HealthResponse | null;
  loading: boolean;
  error?: string | null;
}

export function StatusBanner({ health, loading, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-muted)]">
        Checking converter…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
        API offline: {error}. Start with <code className="font-mono">npm run dev</code>.
      </div>
    );
  }

  if (!health) return null;

  if (!health.converter.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Calibre sidecar offline.</strong>{' '}
        {health.converter.detail || 'Run'}{' '}
        <code className="rounded bg-black/5 px-1 font-mono text-xs dark:bg-white/10">
          docker compose up -d
        </code>{' '}
        for real conversions.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-200">
      Converter ready · {health.converter.engine}
      {health.converter.version ? ` · ${health.converter.version}` : ''} · max{' '}
      {health.maxFileSizeMb}MB
    </div>
  );
}
