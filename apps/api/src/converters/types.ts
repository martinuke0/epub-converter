import type { ConversionOptions, FormatId } from '@epub/shared';

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

export const MIME: Record<FormatId, string> = {
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

export const EXT: Record<FormatId, string> = {
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
