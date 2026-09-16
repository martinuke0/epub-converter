import { useState } from 'react';
import { QUALITY_PRESETS } from '@epub/shared';
import type { ConversionOptions, PdfPageSize, QualityPreset } from '@epub/shared';

interface Props {
  value: ConversionOptions;
  onChange: (next: ConversionOptions) => void;
  showPdf: boolean;
  disabled?: boolean;
}

export function AdvancedOptions({ value, onChange, showPdf, disabled }: Props) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof ConversionOptions>(key: K, v: ConversionOptions[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-3 text-left sm:px-4"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-[var(--color-ink)]">Advanced options</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          className={`text-[var(--color-ink-muted)] transition ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-4 border-t border-[var(--color-border)] px-3 py-4 sm:grid-cols-2 sm:px-4">
          {showPdf && (
            <>
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-sm text-[var(--color-ink-muted)]">Quality preset</span>
                <div className="flex gap-1">
                  {(['screen', 'print', 'kindle'] as QualityPreset[]).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ ...value, ...QUALITY_PRESETS[preset], preset })}
                      className={[
                        'rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition',
                        value.preset === preset
                          ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500/30'
                          : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)] hover:border-brand-400',
                        disabled ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--color-ink-muted)]">PDF page size</span>
                <select
                  disabled={disabled}
                  value={value.pdfPageSize || 'a4'}
                  onChange={(e) => set('pdfPageSize', e.target.value as PdfPageSize)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2"
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="a5">A5</option>
                  <option value="legal">Legal</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['marginTop', 'Top'],
                    ['marginBottom', 'Bottom'],
                    ['marginLeft', 'Left'],
                    ['marginRight', 'Right'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="mb-1 block text-[var(--color-ink-muted)]">
                      Margin {label} (pt)
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      disabled={disabled}
                      value={value[key] ?? 72}
                      onChange={(e) => set(key, Number(e.target.value))}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2"
                    />
                  </label>
                ))}
              </div>
            </>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-ink-muted)]">Image DPI</span>
            <input
              type="number"
              min={72}
              max={600}
              disabled={disabled}
              value={value.imageDpi ?? 150}
              onChange={(e) => set('imageDpi', Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-ink-muted)]">Image quality</span>
            <input
              type="range"
              min={40}
              max={100}
              disabled={disabled}
              value={value.imageQuality ?? 85}
              onChange={(e) => set('imageQuality', Number(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-[var(--color-ink-muted)]">{value.imageQuality ?? 85}</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.embedFonts ?? true}
              onChange={(e) => set('embedFonts', e.target.checked)}
            />
            Embed fonts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.toc ?? true}
              onChange={(e) => set('toc', e.target.checked)}
            />
            Table of contents
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              disabled={disabled}
              checked={value.preserveMetadata ?? true}
              onChange={(e) => set('preserveMetadata', e.target.checked)}
            />
            Preserve metadata
          </label>
        </div>
      )}
    </div>
  );
}
