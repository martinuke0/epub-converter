/**
 * Format catalog — source of truth for FormatId + capability matrix.
 * Enabled v1 sublist: epub, pdf, mobi, azw3, fb2, txt, html, markdown, docx, rtf.
 * Additional ids are registered as coming-soon / disabled (see docs/formats-catalog.md).
 */

export type FormatId =
  // Enabled v1
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
  // Catalog / coming soon
  | 'cbz'
  | 'cbr'
  | 'djvu'
  | 'lit'
  | 'pdb'
  | 'pml'
  | 'rb'
  | 'snb'
  | 'tcr'
  | 'txtz'
  | 'htmlz'
  | 'odt'
  | 'svg'
  | 'kepub'
  | 'lrf'
  | 'pmlz'
  | 'chm'
  | 'fbz'
  | 'azw'
  | 'azw4'
  | 'tex'
  | 'rst'
  | 'org';

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
  /** Registered in catalog but not offered for convert yet */
  comingSoon?: boolean;
}

function enabled(
  partial: Omit<FormatInfo, 'comingSoon'> & { comingSoon?: false }
): FormatInfo {
  return { ...partial, comingSoon: false };
}

function soon(
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
    extensions: ['.mobi'],
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
    notes: 'Markdown input supported; no Markdown writer',
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

  // --- Catalog / coming soon ---
  cbz: soon({
    id: 'cbz',
    label: 'CBZ',
    extensions: ['.cbz'],
    mimeTypes: ['application/vnd.comicbook+zip', 'application/x-cbz'],
    reason: 'Comic archives need a dedicated pipeline',
  }),
  cbr: soon({
    id: 'cbr',
    label: 'CBR',
    extensions: ['.cbr'],
    mimeTypes: ['application/vnd.comicbook-rar', 'application/x-cbr'],
    reason: 'RAR dependency — coming soon',
  }),
  djvu: soon({
    id: 'djvu',
    label: 'DjVu',
    extensions: ['.djvu', '.djv'],
    mimeTypes: ['image/vnd.djvu', 'image/x-djvu'],
    reason: 'Optional engine extra — not enabled yet',
  }),
  lit: soon({
    id: 'lit',
    label: 'LIT',
    extensions: ['.lit'],
    mimeTypes: ['application/x-ms-reader'],
    reason: 'Legacy Microsoft Reader — coming soon',
  }),
  pdb: soon({
    id: 'pdb',
    label: 'PDB',
    extensions: ['.pdb'],
    mimeTypes: ['application/vnd.palm'],
    reason: 'Many Palm variants — coming soon',
  }),
  pml: soon({
    id: 'pml',
    label: 'PML',
    extensions: ['.pml'],
    mimeTypes: ['text/x-palm-markup'],
    reason: 'Palm markup — coming soon',
  }),
  rb: soon({
    id: 'rb',
    label: 'RB',
    extensions: ['.rb'],
    mimeTypes: ['application/x-rocketebook'],
    reason: 'RocketEbook legacy — coming soon',
  }),
  snb: soon({
    id: 'snb',
    label: 'SNB',
    extensions: ['.snb'],
    mimeTypes: ['application/x-shanda-bambook'],
    reason: 'Shanda Bambook — coming soon',
  }),
  tcr: soon({
    id: 'tcr',
    label: 'TCR',
    extensions: ['.tcr'],
    mimeTypes: ['application/x-psion-tcr'],
    reason: 'Psion text — coming soon',
  }),
  txtz: soon({
    id: 'txtz',
    label: 'TXTZ',
    extensions: ['.txtz'],
    mimeTypes: ['application/zip'],
    reason: 'Zipped text package — coming soon',
  }),
  htmlz: soon({
    id: 'htmlz',
    label: 'HTMLZ',
    extensions: ['.htmlz'],
    mimeTypes: ['application/zip', 'application/x-htmlz'],
    reason: 'Explicit HTMLZ id — coming soon (HTML output already uses HTMLZ)',
  }),
  odt: soon({
    id: 'odt',
    label: 'ODT',
    extensions: ['.odt'],
    mimeTypes: ['application/vnd.oasis.opendocument.text'],
    reason: 'Needs stable round-trip checks — coming soon',
  }),
  svg: soon({
    id: 'svg',
    label: 'SVG',
    extensions: ['.svg'],
    mimeTypes: ['image/svg+xml'],
    reason: 'Single-image / niche — coming soon',
  }),
  kepub: soon({
    id: 'kepub',
    label: 'KEPUB',
    extensions: ['.kepub', '.kepub.epub'],
    mimeTypes: ['application/epub+zip'],
    reason: 'Kobo variant needs dedicated flags — coming soon',
  }),
  lrf: soon({
    id: 'lrf',
    label: 'LRF',
    extensions: ['.lrf'],
    mimeTypes: ['application/x-sony-bbeb'],
    reason: 'Sony legacy — coming soon',
  }),
  pmlz: soon({
    id: 'pmlz',
    label: 'PMLZ',
    extensions: ['.pmlz'],
    mimeTypes: ['application/zip'],
    reason: 'Zipped PML — coming soon',
  }),
  chm: soon({
    id: 'chm',
    label: 'CHM',
    extensions: ['.chm'],
    mimeTypes: ['application/vnd.ms-htmlhelp'],
    reason: 'Security/size concerns — coming soon',
  }),
  fbz: soon({
    id: 'fbz',
    label: 'FBZ',
    extensions: ['.fbz'],
    mimeTypes: ['application/zip'],
    reason: 'Zipped FB2 — coming soon',
  }),
  azw: soon({
    id: 'azw',
    label: 'AZW',
    extensions: ['.azw'],
    mimeTypes: ['application/vnd.amazon.ebook'],
    reason: 'Prefer AZW3; DRM often present — coming soon',
  }),
  azw4: soon({
    id: 'azw4',
    label: 'AZW4',
    extensions: ['.azw4'],
    mimeTypes: ['application/vnd.amazon.ebook'],
    reason: 'Print replica; poor reflow — coming soon',
  }),
  tex: soon({
    id: 'tex',
    label: 'LaTeX',
    extensions: ['.tex'],
    mimeTypes: ['application/x-tex', 'text/x-tex'],
    reason: 'Fragile conversion — coming soon',
  }),
  rst: soon({
    id: 'rst',
    label: 'reStructuredText',
    extensions: ['.rst'],
    mimeTypes: ['text/x-rst'],
    reason: 'Optional later — coming soon',
  }),
  org: soon({
    id: 'org',
    label: 'Org-mode',
    extensions: ['.org'],
    mimeTypes: ['text/org', 'text/x-org'],
    reason: 'Optional later — coming soon',
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
}> = ENABLED_FORMAT_IDS.filter((id) => FORMATS[id].canInput && FORMATS[id].canOutput).map(
  (id) => ({
    from: id,
    to: id,
    reason: 'Same format — no conversion needed',
  })
);

export function detectFormat(
  filename: string,
  mimeType?: string
): FormatId | null {
  const lower = filename.toLowerCase();
  // Prefer longer extensions first (e.g. .kepub.epub)
  const sorted = Object.values(FORMATS).slice().sort(
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
  return ENABLED_FORMAT_IDS.map((to) => {
    if (input.comingSoon || !input.canInput) {
      return {
        to,
        enabled: false,
        reason: input.notes || `${input.label} is not available yet`,
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
  if (FORMATS[from]?.comingSoon) {
    return { ok: false, reason: FORMATS[from].notes || 'Format coming soon' };
  }
  if (FORMATS[to]?.comingSoon) {
    return { ok: false, reason: FORMATS[to].notes || 'Format coming soon' };
  }
  const caps = getCapabilities(from);
  const match = caps.find((c) => c.to === to);
  if (!match) return { ok: false, reason: 'Unknown format' };
  return { ok: match.enabled, reason: match.reason };
}

export const MAX_FILE_SIZE_MB = 80;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
