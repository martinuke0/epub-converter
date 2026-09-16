import { useCallback, useRef, useState, type DragEvent } from 'react';
import {
  ENABLED_FORMAT_IDS,
  FORMATS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  detectFormat,
} from '@epub/shared';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT = ENABLED_FORMAT_IDS.flatMap((id) => FORMATS[id].extensions).join(',');

export function DropZone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      const accepted: File[] = [];
      for (const file of files) {
        if (file.size > MAX_FILE_SIZE_BYTES) {
          setError(`${file.name} exceeds the ${MAX_FILE_SIZE_MB}MB limit`);
          continue;
        }
        const id = detectFormat(file.name, file.type);
        if (!id) {
          setError(`${file.name}: unsupported format`);
          continue;
        }
        const info = FORMATS[id];
        if (info.comingSoon || (!info.canInput && !info.canOutput)) {
          setError(
            `${file.name}: ${info.label} is coming soon${info.notes ? ` — ${info.notes}` : ''}`
          );
          continue;
        }
        if (!info.canInput) {
          setError(`${file.name}: ${info.label} is not supported as input`);
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length) {
        setError(null);
        onFiles(accepted);
      } else if (files.length) {
        setError((prev) => prev || 'No supported files selected');
      }
    },
    [onFiles]
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) validate(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={[
          'group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition sm:gap-3 sm:px-6 sm:py-14',
          dragging
            ? 'border-brand-500 bg-brand-50/80'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-brand-400 hover:bg-brand-50/40',
          disabled ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 sm:h-14 sm:w-14">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="max-w-md px-1">
          <p className="text-sm font-medium text-[var(--color-ink)] sm:text-base">
            Drop ebooks here, or <span className="text-brand-600">browse</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)] sm:text-sm">
            EPUB, PDF, Kindle, comics (CBZ), Office, and more — up to {MAX_FILE_SIZE_MB}MB
            each
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept={ACCEPT}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) validate(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
