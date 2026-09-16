import { builtinFormatPlugins } from './formats/index.js';
import { builtinGuardPlugins } from './guards/index.js';
import { builtinPresetPlugins } from './presets/index.js';
import { createRegistry } from './registry.js';
import type { ConversionOptions } from '../options.js';
import type {
  FormatPlugin,
  GuardPlugin,
  PresetPlugin,
  UiSlot,
} from './types.js';

export * from './types.js';
export * from './registry.js';
export * from './run-guards.js';
export { builtinFormatPlugins } from './formats/index.js';
export { builtinPresetPlugins, screenPreset, printPreset, kindlePreset } from './presets/index.js';
export {
  builtinGuardPlugins,
  accessTokenGuard,
  concurrentGuard,
  fileSizeGuard,
  rateLimitGuard,
} from './guards/index.js';

export const formatRegistry = createRegistry<FormatPlugin>();
export const presetRegistry = createRegistry<PresetPlugin>();
export const guardRegistry = createRegistry<GuardPlugin>();

for (const p of builtinFormatPlugins) formatRegistry.register(p);
for (const p of builtinPresetPlugins) presetRegistry.register(p);
for (const p of builtinGuardPlugins) guardRegistry.register(p);

/** Presets the UI should show (UiSlot preset-picker). */
export function listUiPresets(): PresetPlugin[] {
  return presetRegistry
    .list()
    .filter((p) => (p.ui?.slot ?? 'preset-picker') === 'preset-picker')
    .sort((a, b) => (a.ui?.order ?? 100) - (b.ui?.order ?? 100));
}

export function listGuards(): GuardPlugin[] {
  return guardRegistry.list();
}

export function getPreset(id: string): PresetPlugin | undefined {
  return presetRegistry.get(id);
}

/** Apply a preset onto base options (preset fills ConvertOptions; user can still tweak). */
export function applyPreset(
  presetId: string,
  base: Partial<ConversionOptions> = {}
): ConversionOptions {
  const preset = presetRegistry.get(presetId);
  if (!preset) return { ...base };
  return { ...base, ...preset.options };
}

export type { UiSlot };
