import { useCallback, useRef, useState, type DragEvent } from 'react';
import { FORMATS, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, detectFormat } from '@epub/shared';

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const ACCEPT = Object.values(FORMATS)
  .flatMap((f) => f.extensions)
  .join(',');

export function DropZone({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback((list: FileList | File[]) => {
    const files = Array.from(list);
    const accepted: File[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`${file.name} exceeds the ${MAX_FILE_SIZE_MB}MB limit`);
        continue;
      }
      if (!detectFormat(file.name, file.type)) {
        setError(`${file.name}: unsupported format`);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length) {
      setError(null);
      onFiles(accepted);
    } else if (!error && files.length) {
      setError('No supported files selected');
    }
  }, [onFiles, error]);

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
          'group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition',
          dragging
            ? 'border-brand-500 bg-brand-50/80 dark:bg-brand-900/20'
            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-brand-400 hover:bg-brand-50/40 dark:hover:bg-brand-900/10',
          disabled ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-base font-medium text-[var(--color-ink)]">
            Drop ebooks here, or <span className="text-brand-600 dark:text-brand-400">browse</span>
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            EPUB, PDF, MOBI, AZW3, FB2, DOCX, RTF, HTML, Markdown, TXT — up to {MAX_FILE_SIZE_MB}MB each
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
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
