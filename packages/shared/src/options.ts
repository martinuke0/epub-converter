export type PdfPageSize = 'a4' | 'letter' | 'a5' | 'legal';

export interface ConversionOptions {
  /** PDF page size when outputting PDF */
  pdfPageSize?: PdfPageSize;
  /** Margins in points (PDF) */
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  /** Embed fonts in output when possible */
  embedFonts?: boolean;
  /** Generate / preserve table of contents */
  toc?: boolean;
  /** Preserve source metadata */
  preserveMetadata?: boolean;
  /** Image DPI for rasterization */
  imageDpi?: number;
  /** Image quality 0–100 */
  imageQuality?: number;
}

export const DEFAULT_OPTIONS: Required<ConversionOptions> = {
  pdfPageSize: 'a4',
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
  embedFonts: true,
  toc: true,
  preserveMetadata: true,
  imageDpi: 150,
  imageQuality: 85,
};
