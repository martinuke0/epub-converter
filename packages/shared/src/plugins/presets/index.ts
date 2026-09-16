import type { PresetPlugin } from '../types.js';
import { kindlePreset } from './kindle.js';
import { printPreset } from './print.js';
import { screenPreset } from './screen.js';

export { screenPreset, printPreset, kindlePreset };

export const builtinPresetPlugins: PresetPlugin[] = [
  screenPreset,
  printPreset,
  kindlePreset,
];
