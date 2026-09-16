export type PdfPageSize = 'a4' | 'letter' | 'a5' | 'legal';

export type QualityPreset = 'screen' | 'print' | 'kindle';

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
  /** Image DPI for rasterization (UI / presets; best-effort with engine) */
  imageDpi?: number;
  /** Image quality 0–100 → engine --jpegquality */
  imageQuality?: number;
  /** Engine --output-profile (e.g. kindle, tablet, default) */
  outputProfile?: string;
  /** Quality preset shorthand */
  preset?: QualityPreset;
}

export const DEFAULT_OPTIONS: Omit<Required<ConversionOptions>, 'preset' | 'outputProfile'> = {
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

export const QUALITY_PRESETS: Record<QualityPreset, Partial<ConversionOptions>> = {
  screen: { imageDpi: 96, imageQuality: 80, embedFonts: true },
  print: { imageDpi: 300, imageQuality: 95, embedFonts: true },
  kindle: { imageDpi: 167, imageQuality: 75, embedFonts: false },
};
