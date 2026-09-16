# Plugin system

Epub is designed so **everything looks like a plugin**: formats, PDF quality presets, and pre-convert guards. Calibre remains the conversion engine — plugins configure, guard, and present; they do not replace Calibre (unless you intentionally use the local stub).

Shared code lives in `packages/shared/src/plugins/`.

## Plugin kinds

| Kind | Purpose | Registry |
|------|---------|----------|
| `FormatPlugin` | Input/output format id, labels, mime/ext, capability contribution | `formatRegistry` |
| `PresetPlugin` | Named option bundles (especially PDF quality) | `presetRegistry` |
| `GuardPlugin` | Pre-convert checks (rate limit, size, abuse, access token) | `guardRegistry` |

Optional `ui` (`UiSlot`) lets the web app discover presets without hardcoding.

## Registry API

```ts
import { createRegistry, presetRegistry } from '@epub/shared';

createRegistry<MyPlugin>(); // register / list / get / has
presetRegistry.get('screen');
presetRegistry.list();
```

## How to add a format (3 steps)

1. Add an entry to `FORMATS` in `packages/shared/src/formats.ts` (and mirror extensions in `converter/server.py` if needed).
2. Format plugins are auto-derived from `FORMATS` via `builtinFormatPlugins` — no extra register call.
3. Rebuild shared: `npm run build -w @epub/shared`.

For catalog-only formats, set `comingSoon: true` and `canInput`/`canOutput` false with a `notes` reason (see `docs/formats-catalog.md`).

## How to add a preset (3 steps)

1. Create `packages/shared/src/plugins/presets/my-preset.ts`:

```ts
import type { PresetPlugin } from '../types.js';

export const myPreset: PresetPlugin = {
  kind: 'preset',
  id: 'my-preset',
  label: 'My preset',
  description: 'Short blurb',
  appliesTo: ['pdf'],
  options: {
    pdfPageSize: 'letter',
    imageDpi: 200,
    imageQuality: 90,
    marginTop: 60,
    marginBottom: 60,
    marginLeft: 60,
    marginRight: 60,
  },
  ui: { slot: 'preset-picker', label: 'My preset', order: 40 },
};
```

2. Export and push into the array in `packages/shared/src/plugins/presets/index.ts`.
3. Rebuild — the UI preset picker reads `listUiPresets()`.

## How to add a guard (3 steps)

1. Create `packages/shared/src/plugins/guards/my-guard.ts` implementing `GuardPlugin` (`check` + optional `release`).
2. Add it to `builtinGuardPlugins` in `packages/shared/src/plugins/guards/index.ts` (order matters).
3. Wire is automatic: Hono and the Cloudflare Worker load `listGuards()` / `runGuards()`.

Guards return clear JSON on deny, e.g. `{ error, code: 'rate_limit', retryAfterSec }` with HTTP 429 / 413 / 401.

## Layout

```
packages/shared/src/plugins/
  types.ts
  registry.ts
  run-guards.ts
  index.ts
  formats/builtin.ts
  presets/{screen,print,kindle}.ts
  guards/{access-token,file-size,rate-limit,concurrent}.ts
```
