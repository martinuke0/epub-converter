import { FORMATS, type FormatInfo } from '../../formats.js';
import type { FormatPlugin } from '../types.js';

export function formatInfoToPlugin(info: FormatInfo): FormatPlugin {
  return {
    kind: 'format',
    id: info.id,
    label: info.label,
    extensions: info.extensions,
    mimeTypes: info.mimeTypes,
    canInput: info.canInput,
    canOutput: info.canOutput,
    notes: info.notes,
    comingSoon: info.comingSoon,
    ui: {
      slot: 'format-picker',
      label: info.label,
      description: info.comingSoon ? info.notes : undefined,
      order: info.comingSoon ? 1000 : 0,
    },
  };
}

/** Format plugins derived from the shared FORMATS matrix (engine unchanged). */
export const builtinFormatPlugins: FormatPlugin[] =
  Object.values(FORMATS).map(formatInfoToPlugin);
