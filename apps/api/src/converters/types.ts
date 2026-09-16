import { FORMATS, type ConversionOptions, type FormatId } from '@epub/shared';

export interface ConvertRequest {
  buffer: Buffer;
  filename: string;
  from: FormatId;
  to: FormatId;
  options: ConversionOptions;
}

export interface ConvertResult {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  jobId?: string;
}

export interface ConverterHealth {
  ok: boolean;
  engine: string;
  version?: string;
  mode: 'local' | 'remote' | 'stub';
  detail?: string;
}

export interface Converter {
  readonly name: string;
  health(): Promise<ConverterHealth>;
  convert(req: ConvertRequest): Promise<ConvertResult>;
}

/** Output MIME overrides where shared mimeTypes[0] is not the convert result type. */
const MIME_OVERRIDES: Partial<Record<FormatId, string>> = {
  html: 'application/zip', // HTMLZ package
};

const EXT_OVERRIDES: Partial<Record<FormatId, string>> = {
  html: '.htmlz',
};

export function mimeFor(format: FormatId): string {
  return (
    MIME_OVERRIDES[format] ||
    FORMATS[format]?.mimeTypes[0] ||
    'application/octet-stream'
  );
}

export function extFor(format: FormatId): string {
  if (EXT_OVERRIDES[format]) return EXT_OVERRIDES[format]!;
  const ext = FORMATS[format]?.extensions[0];
  return ext || `.${format}`;
}

/** @deprecated Prefer mimeFor / extFor — kept for stub converter */
export const MIME: Partial<Record<FormatId, string>> = {
  epub: 'application/epub+zip',
  pdf: 'application/pdf',
  mobi: 'application/x-mobipocket-ebook',
  azw3: 'application/vnd.amazon.ebook',
  fb2: 'application/x-fictionbook+xml',
  txt: 'text/plain',
  html: 'application/zip',
  markdown: 'text/markdown',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf',
};

export const EXT: Partial<Record<FormatId, string>> = {
  epub: '.epub',
  pdf: '.pdf',
  mobi: '.mobi',
  azw3: '.azw3',
  fb2: '.fb2',
  txt: '.txt',
  html: '.htmlz',
  markdown: '.md',
  docx: '.docx',
  rtf: '.rtf',
};
