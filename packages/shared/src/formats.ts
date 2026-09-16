/**
 * Format catalog — source of truth for FormatId + capability matrix.
 * Enabled: every Calibre-realistic format from our catalog.
 * Still blocked: DRM / non-ebook / RAR-painful / unsupported (see docs/formats-catalog.md).
 */

export type FormatId =
  // Core
  | 'epub'
  | 'pdf'
  | 'mobi'
  | 'azw3'
  | 'fb2'
  | 'txt'
  | 'html'
  | 'markdown'
  | 'docx'
  | 'rtf'
  // Comics / scans
  | 'cbz'
  | 'cbr'
  | 'djvu'
  // Legacy / device
  | 'lit'
  | 'pdb'
  | 'pml'
  | 'rb'
  | 'snb'
  | 'tcr'
  | 'txtz'
  | 'htmlz'
  | 'kepub'
  | 'lrf'
  | 'pmlz'
  | 'chm'
  | 'fbz'
  | 'azw'
  | 'azw4'
  // Office extras
  | 'odt'
  // Catalog-only blocked
  | 'svg'
  | 'tex'
  | 'rst'
  | 'org'
  | 'pptx'
  | 'csv';

export interface FormatInfo {
  id: FormatId;
  label: string;
  extensions: string[];
  mimeTypes: string[];
  /** Whether the conversion engine can reliably read this format */
  canInput: boolean;
  /** Whether the conversion engine can write this format */
  canOutput: boolean;
  notes?: string;
  /** Registered in catalog but not offered for convert */
  comingSoon?: boolean;
}

function enabled(
  partial: Omit<FormatInfo, 'comingSoon'> & { comingSoon?: false }
): FormatInfo {
  return { ...partial, comingSoon: false };
}

function blocked(
  partial: Omit<FormatInfo, 'canInput' | 'canOutput' | 'comingSoon'> & {
    canInput?: boolean;
    canOutput?: boolean;
    reason: string;
  }
): FormatInfo {
  const { reason, canInput = false, canOutput = false, ...rest } = partial;
  return {
    ...rest,
    canInput,
    canOutput,
    comingSoon: true,
    notes: reason,
  };
}

export const FORMATS: Record<FormatId, FormatInfo> = {
  // --- Core (always on) ---
  epub: enabled({
    id: 'epub',
    label: 'EPUB',
    extensions: ['.epub'],
    mimeTypes: ['application/epub+zip'],
    canInput: true,
    canOutput: true,
  }),
  pdf: enabled({
    id: 'pdf',
    label: 'PDF',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    canInput: true,
    canOutput: true,
    notes: 'PDF→ebook reflow quality varies by source layout',
  }),
  mobi: enabled({
    id: 'mobi',
    label: 'MOBI',
    extensions: ['.mobi', '.prc'],
    mimeTypes: ['application/x-mobipocket-ebook'],
    canInput: true,
    canOutput: true,
  }),
  azw3: enabled({
    id: 'azw3',
    label: 'AZW3',
    extensions: ['.azw3'],
    mimeTypes: ['application/vnd.amazon.ebook'],
    canInput: true,
    canOutput: true,
  }),
  fb2: enabled({
    id: 'fb2',
    label: 'FB2',
    extensions: ['.fb2'],
    mimeTypes: ['application/x-fictionbook+xml', 'text/xml'],
    canInput: true,
    canOutput: true,
  }),
  txt: enabled({
    id: 'txt',
    label: 'TXT',
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    canInput: true,
    canOutput: true,
  }),
  html: enabled({
    id: 'html',
    label: 'HTML',
    extensions: ['.html', '.htm'],
    mimeTypes: ['text/html'],
    canInput: true,
    canOutput: true,
    notes: 'Output is HTMLZ (zipped HTML package)',
  }),
  markdown: enabled({
    id: 'markdown',
    label: 'Markdown',
    extensions: ['.md', '.markdown'],
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    canInput: true,
    canOutput: false,
    notes: 'Markdown input only — no Markdown writer',
  }),
  docx: enabled({
    id: 'docx',
    label: 'DOCX',
    extensions: ['.docx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    canInput: true,
    canOutput: true,
  }),
  rtf: enabled({
    id: 'rtf',
    label: 'RTF',
    extensions: ['.rtf'],
    mimeTypes: ['application/rtf', 'text/rtf'],
    canInput: true,
    canOutput: true,
  }),

  // --- Comics / scans ---
  cbz: enabled({
    id: 'cbz',
    label: 'CBZ',
    extensions: ['.cbz'],
    mimeTypes: ['application/vnd.comicbook+zip', 'application/x-cbz'],
    canInput: true,
    canOutput: false,
    notes: 'Comic ZIP input — image-based; reflow is limited',
  }),
  cbr: blocked({
    id: 'cbr',
    label: 'CBR',
    extensions: ['.cbr'],
    mimeTypes: ['application/vnd.comicbook-rar', 'application/x-cbr'],
    reason: 'Needs unrar in the converter image — use CBZ instead',
  }),
  djvu: enabled({
    id: 'djvu',
    label: 'DjVu',
    extensions: ['.djvu', '.djv'],
    mimeTypes: ['image/vnd.djvu', 'image/x-djvu'],
    canInput: true,
    canOutput: false,
    notes: 'Best results when the DjVu contains embedded OCR text',
  }),

  // --- Legacy / device (Calibre FAQ) ---
  lit: enabled({
    id: 'lit',
    label: 'LIT',
    extensions: ['.lit'],
    mimeTypes: ['application/x-ms-reader'],
    canInput: true,
    canOutput: true,
  }),
  pdb: enabled({
    id: 'pdb',
    label: 'PDB',
    extensions: ['.pdb'],
    mimeTypes: ['application/vnd.palm'],
    canInput: true,
    canOutput: true,
    notes: 'Palm/eReader/Plucker/PML/zTxt variants — quality varies',
  }),
  pml: enabled({
    id: 'pml',
    label: 'PML',
    extensions: ['.pml'],
    mimeTypes: ['text/x-palm-markup'],
    canInput: true,
    canOutput: false,
    notes: 'Palm markup input — use PMLZ for output',
  }),
  rb: enabled({
    id: 'rb',
    label: 'RB',
    extensions: ['.rb'],
    mimeTypes: ['application/x-rocketebook'],
    canInput: true,
    canOutput: true,
  }),
  snb: enabled({
    id: 'snb',
    label: 'SNB',
    extensions: ['.snb'],
    mimeTypes: ['application/x-shanda-bambook'],
    canInput: true,
    canOutput: true,
  }),
  tcr: enabled({
    id: 'tcr',
    label: 'TCR',
    extensions: ['.tcr'],
    mimeTypes: ['application/x-psion-tcr'],
    canInput: true,
    canOutput: true,
  }),
  txtz: enabled({
    id: 'txtz',
    label: 'TXTZ',
    extensions: ['.txtz'],
    mimeTypes: ['application/zip', 'application/x-txtz'],
    canInput: true,
    canOutput: true,
  }),
  htmlz: enabled({
    id: 'htmlz',
    label: 'HTMLZ',
    extensions: ['.htmlz'],
    mimeTypes: ['application/zip', 'application/x-htmlz'],
    canInput: true,
    canOutput: true,
  }),
  kepub: enabled({
    id: 'kepub',
    label: 'KEPUB',
    extensions: ['.kepub', '.kepub.epub'],
    mimeTypes: ['application/epub+zip'],
    canInput: true,
    canOutput: true,
    notes: 'Kobo EPUB variant',
  }),
  lrf: enabled({
    id: 'lrf',
    label: 'LRF',
    extensions: ['.lrf'],
    mimeTypes: ['application/x-sony-bbeb'],
    canInput: true,
    canOutput: true,
  }),
  pmlz: enabled({
    id: 'pmlz',
    label: 'PMLZ',
    extensions: ['.pmlz'],
    mimeTypes: ['application/zip', 'application/x-pmlz'],
    canInput: false,
    canOutput: true,
    notes: 'Zipped PML output — use PML for input',
  }),
  chm: enabled({
    id: 'chm',
    label: 'CHM',
    extensions: ['.chm'],
    mimeTypes: ['application/vnd.ms-htmlhelp'],
    canInput: true,
    canOutput: false,
    notes: 'Windows help input — large/complex CHMs may fail',
  }),
  fbz: enabled({
    id: 'fbz',
    label: 'FBZ',
    extensions: ['.fbz'],
    mimeTypes: ['application/zip', 'application/x-fbz'],
    canInput: true,
    canOutput: false,
    notes: 'Zipped FB2 input',
  }),
  azw: enabled({
    id: 'azw',
    label: 'AZW',
    extensions: ['.azw'],
    mimeTypes: ['application/vnd.amazon.ebook'],
    canInput: true,
    canOutput: false,
    notes: 'Kindle legacy input — DRM-free only; prefer AZW3 output',
  }),
  azw4: enabled({
    id: 'azw4',
    label: 'AZW4',
    extensions: ['.azw4'],
    mimeTypes: ['application/vnd.amazon.ebook'],
    canInput: true,
    canOutput: false,
    notes: 'Print replica input — poor reflow',
  }),

  // --- Office extras ---
  odt: enabled({
    id: 'odt',
    label: 'ODT',
    extensions: ['.odt'],
    mimeTypes: ['application/vnd.oasis.opendocument.text'],
    canInput: true,
    canOutput: false,
    notes: 'OpenDocument text input',
  }),

  // --- Blocked (not realistic / not ebook-convert) ---
  svg: blocked({
    id: 'svg',
    label: 'SVG',
    extensions: ['.svg'],
    mimeTypes: ['image/svg+xml'],
    reason: 'Single-image niche — not a standard ebook-convert path',
  }),
  tex: blocked({
    id: 'tex',
    label: 'LaTeX',
    extensions: ['.tex'],
    mimeTypes: ['application/x-tex', 'text/x-tex'],
    reason: 'Not supported by ebook-convert',
  }),
  rst: blocked({
    id: 'rst',
    label: 'reStructuredText',
    extensions: ['.rst'],
    mimeTypes: ['text/x-rst'],
    reason: 'Not supported by ebook-convert',
  }),
  org: blocked({
    id: 'org',
    label: 'Org-mode',
    extensions: ['.org'],
    mimeTypes: ['text/org', 'text/x-org'],
    reason: 'Not supported by ebook-convert',
  }),
  pptx: blocked({
    id: 'pptx',
    label: 'PPTX',
    extensions: ['.pptx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    reason: 'ebook-convert does not accept PowerPoint as input',
  }),
  csv: blocked({
    id: 'csv',
    label: 'CSV',
    extensions: ['.csv'],
    mimeTypes: ['text/csv'],
    reason: 'ebook-convert does not accept CSV as input',
  }),
};

/** Enabled formats only (UI pickers / convert). */
export const ENABLED_FORMAT_IDS: FormatId[] = (
  Object.keys(FORMATS) as FormatId[]
).filter((id) => !FORMATS[id].comingSoon);

/** Pairs that are unsupported or strongly discouraged */
const BLOCKED_PAIRS: Array<{
  from: FormatId;
  to: FormatId;
  reason: string;
}> = ENABLED_FORMAT_IDS.filter(
  (id) => FORMATS[id].canInput && FORMATS[id].canOutput
).map((id) => ({
  from: id,
  to: id,
  reason: 'Same format — no conversion needed',
}));

export function detectFormat(
  filename: string,
  mimeType?: string
): FormatId | null {
  const lower = filename.toLowerCase();
  const sorted = Object.values(FORMATS)
    .slice()
    .sort(
      (a, b) =>
        Math.max(...b.extensions.map((e) => e.length)) -
        Math.max(...a.extensions.map((e) => e.length))
    );
  for (const format of sorted) {
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
  if (input === 'azw' || input === 'azw4') return 'epub';
  if (input === 'cbz' || input === 'djvu') return 'pdf';
  if (input === 'chm' || input === 'odt' || input === 'fbz') return 'epub';
  if (input === 'pml') return 'epub';
  return 'epub';
}

export interface ConversionCapability {
  to: FormatId;
  enabled: boolean;
  reason?: string;
}

export function getCapabilities(from: FormatId): ConversionCapability[] {
  const input = FORMATS[from];
  if (!input) {
    return [];
  }
  // Output targets: enabled formats that can be written
  const outputs = ENABLED_FORMAT_IDS.filter((id) => FORMATS[id].canOutput);
  return outputs.map((to) => {
    if (input.comingSoon || !input.canInput) {
      return {
        to,
        enabled: false,
        reason: input.notes || `${input.label} is not available as input`,
      };
    }
    const output = FORMATS[to];
    if (output.comingSoon || !output.canOutput) {
      return {
        to,
        enabled: false,
        reason: output.notes || `${output.label} is not supported as output`,
      };
    }
    const blockedPair = BLOCKED_PAIRS.find((p) => p.from === from && p.to === to);
    if (blockedPair) {
      return { to, enabled: false, reason: blockedPair.reason };
    }
    return { to, enabled: true };
  });
}

export function isConversionSupported(
  from: FormatId,
  to: FormatId
): {
  ok: boolean;
  reason?: string;
} {
  if (FORMATS[from]?.comingSoon || !FORMATS[from]?.canInput) {
    return {
      ok: false,
      reason: FORMATS[from]?.notes || 'Format not available as input',
    };
  }
  if (FORMATS[to]?.comingSoon || !FORMATS[to]?.canOutput) {
    return {
      ok: false,
      reason: FORMATS[to]?.notes || 'Format not available as output',
    };
  }
  const caps = getCapabilities(from);
  const match = caps.find((c) => c.to === to);
  if (!match) return { ok: false, reason: 'Unknown format' };
  return { ok: match.enabled, reason: match.reason };
}

export const MAX_FILE_SIZE_MB = 80;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
