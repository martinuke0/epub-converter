import type { PresetPlugin } from '../types.js';

/** Tuned toward ebook / PDF-for-eink via Calibre output-profile. */
export const kindlePreset: PresetPlugin = {
  kind: 'preset',
  id: 'kindle',
  label: 'Kindle',
  description: 'Compact layout and Calibre kindle output profile',
  appliesTo: ['pdf', 'mobi', 'azw3'],
  options: {
    pdfPageSize: 'a5',
    marginTop: 36,
    marginBottom: 36,
    marginLeft: 36,
    marginRight: 36,
    embedFonts: true,
    toc: true,
    preserveMetadata: true,
    imageDpi: 167,
    imageQuality: 80,
    outputProfile: 'kindle',
  },
  ui: {
    slot: 'preset-picker',
    label: 'Kindle',
    description: 'E-ink / Kindle-oriented',
    order: 30,
  },
};
