import type { PresetPlugin } from '../types.js';

/** Higher DPI / margins for print. */
export const printPreset: PresetPlugin = {
  kind: 'preset',
  id: 'print',
  label: 'Print',
  description: 'Higher DPI and generous margins for paper',
  appliesTo: ['pdf'],
  options: {
    pdfPageSize: 'a4',
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
    embedFonts: true,
    toc: true,
    preserveMetadata: true,
    imageDpi: 300,
    imageQuality: 95,
    outputProfile: 'default',
  },
  ui: {
    slot: 'preset-picker',
    label: 'Print',
    description: 'Print-ready quality',
    order: 20,
  },
};
