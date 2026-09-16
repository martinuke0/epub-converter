export type FormatId =
  | 'epub'
  | 'pdf'
  | 'mobi'
  | 'azw3'
  | 'fb2'
  | 'txt'
  | 'html'
  | 'markdown'
  | 'docx'
  | 'rtf';

export interface FormatInfo {
  id: FormatId;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  /** Whether Calibre ebook-convert can reliably read this format */
  canInput: boolean;
  /** Whether Calibre ebook-convert can write this format */
  canOutput: boolean;
  notes?: string;
}

export const FORMATS: Record<FormatId, FormatInfo> = {
  epub: {
    id: 'epub',
    label: 'EPUB',
    extensions: ['.epub'],
    mimeTypes: ['application/epub+zip'],
    canInput: true,
    canOutput: true,
  },
  pdf: {
    id: 'pdf',
    label: 'PDF',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    canInput: true,
    canOutput: true,
    notes: 'PDF→ebook reflow quality varies by source layout',
  },
  mobi: {
    id: 'mobi',
    label: 'MOBI',
    extensions: ['.mobi'],
    mimeTypes: ['application/x-mobipocket-ebook'],
    canInput: true,
    canOutput: true,
  },
  azw3: {
    id: 'azw3',
    label: 'AZW3',
    extensions: ['.azw3', '.azw'],
    mimeTypes: ['application/vnd.amazon.ebook'],
    canInput: true,
    canOutput: true,
  },
  fb2: {
    id: 'fb2',
    label: 'FB2',
    extensions: ['.fb2'],
    mimeTypes: ['application/x-fictionbook+xml', 'text/xml'],
    canInput: true,
    canOutput: true,
  },
  txt: {
    id: 'txt',
    label: 'TXT',
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    canInput: true,
    canOutput: true,
  },
  html: {
    id: 'html',
    label: 'HTML',
    extensions: ['.html', '.htm', '.htmlz'],
    mimeTypes: ['text/html', 'application/zip'],
    canInput: true,
    canOutput: true,
    notes: 'Output is Calibre HTMLZ (zipped HTML package)',
  },
  markdown: {
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md', '.markdown'],
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    canInput: true,
    canOutput: false,
    notes: 'Markdown input supported; Calibre has no Markdown writer',
  },
  docx: {
    id: 'docx',
    label: 'DOCX',
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    canInput: true,
    canOutput: true,
  },
  rtf: {
    id: 'rtf',
    label: 'RTF',
    extensions: ['.rtf'],
    mimeTypes: ['application/rtf', 'text/rtf'],
    canInput: true,
    canOutput: true,
  },
};

/** Pairs that are unsupported or strongly discouraged */
const BLOCKED_PAIRS: Array<{
  from: FormatId;
  to: FormatId;
  reason: string;
}> = [
  {
    from: 'pdf',
    to: 'pdf',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'mobi',
    to: 'mobi',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'azw3',
    to: 'azw3',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'fb2',
    to: 'fb2',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'txt',
    to: 'txt',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'html',
    to: 'html',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'markdown',
    to: 'markdown',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'docx',
    to: 'docx',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'rtf',
    to: 'rtf',
    reason: 'Same format — no conversion needed',
  },
  {
    from: 'epub',
    to: 'epub',
    reason: 'Same format — no conversion needed',
  },
];

export function detectFormat(
  filename: string,
  mimeType?: string
): FormatId | null {
  const lower = filename.toLowerCase();
  for (const format of Object.values(FORMATS)) {
    if (format.extensions.some((ext) => lower.endsWith(ext))) {
      return format.id;
    }
  }
  if (mimeType) {
    for (const format of Object.values(FORMATS)) {
      if (format.mimeTypes.includes(mimeType)) {
        return format.id;
      }
    }
  }
  return null;
}

export function getDefaultOutput(input: FormatId): FormatId {
  if (input === 'epub') return 'pdf';
  if (input === 'pdf') return 'epub';
  return 'epub';
}

export interface ConversionCapability {
  to: FormatId;
  enabled: boolean;
  reason?: string;
}

export function getCapabilities(from: FormatId): ConversionCapability[] {
  const input = FORMATS[from];
  return (Object.keys(FORMATS) as FormatId[]).map((to) => {
    if (!input.canInput) {
      return {
        to,
        enabled: false,
        reason: `${input.label} is not supported as input`,
      };
    }
    const output = FORMATS[to];
    if (!output.canOutput) {
      return {
        to,
        enabled: false,
        reason: `${output.label} is not supported as output`,
      };
    }
    const blocked = BLOCKED_PAIRS.find((p) => p.from === from && p.to === to);
    if (blocked) {
      return { to, enabled: false, reason: blocked.reason };
    }
    return { to, enabled: true };
  });
}

export function isConversionSupported(from: FormatId, to: FormatId): {
  ok: boolean;
  reason?: string;
} {
  const caps = getCapabilities(from);
  const match = caps.find((c) => c.to === to);
  if (!match) return { ok: false, reason: 'Unknown format' };
  return { ok: match.enabled, reason: match.reason };
}

export const MAX_FILE_SIZE_MB = 80;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
