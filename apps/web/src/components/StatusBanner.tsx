import type { HealthResponse } from '../lib/api';

interface Props {
  health: HealthResponse | null;
  loading: boolean;
  error?: string | null;
  /** True while converter is cold / warming */
  warming?: boolean;
}

export function StatusBanner({ health, loading, error, warming }: Props) {
  if (loading && !health) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-muted)]">
        <span className="inline-flex items-center gap-2">
          <Spinner />
          Warming up…
        </span>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Converter unavailable: {error}. Check back shortly.
      </div>
    );
  }

  if (!health) return null;

  if (warming || !health.converter.ok) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
        <div className="flex items-start gap-3">
          <Spinner className="mt-0.5 shrink-0 text-sky-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Warming converter…</p>
            <p className="mt-1 text-sky-900/80">
              {health.converter.detail ||
                'The converter is starting. Convert will wait until it is ready.'}
            </p>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-200/80"
              aria-hidden
            >
              <div className="warming-bar h-full w-1/3 rounded-full bg-sky-500/80" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
      Converter ready · max {health.maxFileSizeMb}MB
      {health.privateMode ? ' · private mode' : ''}
    </div>
  );
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"
      />
    </svg>
  );
}
