import { FORMATS, type FormatId } from '@epub/shared';
import type { Capability } from '../lib/api';

interface Props {
  value: FormatId;
  capabilities: Capability[];
  onChange: (to: FormatId) => void;
  disabled?: boolean;
}

const HERO: FormatId[] = ['epub', 'pdf'];

export function FormatPicker({ value, capabilities, onChange, disabled }: Props) {
  const sorted = [...capabilities].sort((a, b) => {
    const ah = HERO.includes(a.to) ? 0 : 1;
    const bh = HERO.includes(b.to) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return FORMATS[a.to].label.localeCompare(FORMATS[b.to].label);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Output format
        </h2>
        <span className="text-xs text-[var(--color-ink-muted)]">
          Only sensible targets are enabled
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {sorted.map((cap) => {
          const fmt = FORMATS[cap.to];
          const selected = value === cap.to;
          const hero = HERO.includes(cap.to);
          return (
            <button
              key={cap.to}
              type="button"
              disabled={disabled || !cap.enabled}
              title={cap.enabled ? fmt.label : cap.reason}
              onClick={() => onChange(cap.to)}
              className={[
                'relative min-h-[3.25rem] rounded-xl border px-2.5 py-2.5 text-left transition sm:px-3 sm:py-3',
                selected
                  ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)]',
                cap.enabled ? 'hover:border-brand-400' : 'cursor-not-allowed opacity-45',
                hero && cap.enabled ? 'shadow-sm' : '',
              ].join(' ')}
            >
              <div className="pr-8 text-sm font-semibold text-[var(--color-ink)]">{fmt.label}</div>
              {!cap.enabled && (
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-[var(--color-ink-muted)]">
                  {cap.reason}
                </div>
              )}
              {hero && cap.enabled && (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-700 sm:right-2 sm:top-2">
                  hero
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
