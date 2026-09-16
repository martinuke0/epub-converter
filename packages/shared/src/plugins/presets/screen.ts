import type { PresetPlugin } from '../types.js';

/** Comfortable on-screen reading PDF. */
export const screenPreset: PresetPlugin = {
  kind: 'preset',
  id: 'screen',
  label: 'Screen',
  description: 'Comfortable reading — moderate DPI, balanced margins',
  appliesTo: ['pdf'],
  options: {
    pdfPageSize: 'a5',
    marginTop: 54,
    marginBottom: 54,
    marginLeft: 54,
    marginRight: 54,
    embedFonts: true,
    toc: true,
    preserveMetadata: true,
    imageDpi: 150,
    imageQuality: 85,
    outputProfile: 'tablet',
  },
  ui: {
    slot: 'preset-picker',
    label: 'Screen',
    description: 'Comfortable reading',
    order: 10,
  },
};
