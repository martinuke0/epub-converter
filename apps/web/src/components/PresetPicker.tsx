import { listUiPresets, type FormatId, type PresetPlugin } from '@epub/shared';

interface Props {
  value: string | null;
  onSelect: (preset: PresetPlugin) => void;
  onClear: () => void;
  /** Current output format — filters appliesTo */
  outputFormat?: FormatId | null;
  disabled?: boolean;
}

export function PresetPicker({
  value,
  onSelect,
  onClear,
  outputFormat,
  disabled,
}: Props) {
  const presets = listUiPresets().filter((p) => {
    if (!p.appliesTo?.length) return true;
    if (!outputFormat) return true;
    return p.appliesTo.includes(outputFormat);
  });

  if (!presets.length) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--color-ink)]">Quality preset</p>
        {value && (
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            className="text-xs text-[var(--color-ink-muted)] underline-offset-2 hover:underline"
          >
            Clear preset
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-[var(--color-ink-muted)]">
        Fills advanced options — you can still tweak afterward.
      </p>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => {
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              title={p.description}
              onClick={() => onSelect(p)}
              className={`min-w-[9.5rem] flex-1 rounded-xl border px-3 py-2 text-left text-sm transition sm:flex-none ${
                active
                  ? 'border-brand-600 bg-brand-50 text-brand-900'
                  : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-ink)] hover:border-brand-400'
              } disabled:opacity-50`}
            >
              <span className="font-medium">{p.label}</span>
              {p.description ? (
                <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">
                  {p.description}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
