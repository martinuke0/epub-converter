# Formats catalog

Shared source of truth: `packages/shared` (`FormatPlugin` registry + `FORMATS`).  
The conversion engine is Calibre `ebook-convert` (see technical README). Formats the engine cannot handle stay **registered but disabled** (`comingSoon`) with a reason.

## Enabled (Calibre-realistic)

### Core

| Id | Label | In | Out | Notes |
|----|-------|:--:|:---:|-------|
| `epub` | EPUB | ✓ | ✓ | Hero pair with PDF |
| `pdf` | PDF | ✓ | ✓ | PDF→ebook reflow varies |
| `mobi` | MOBI | ✓ | ✓ | Also accepts `.prc` as input suffix |
| `azw3` | AZW3 | ✓ | ✓ | |
| `fb2` | FB2 | ✓ | ✓ | |
| `txt` | TXT | ✓ | ✓ | |
| `html` | HTML | ✓ | ✓ | Output is HTMLZ |
| `markdown` | Markdown | ✓ | — | Input only |
| `docx` | DOCX | ✓ | ✓ | |
| `rtf` | RTF | ✓ | ✓ | |

### Kindle / device / legacy

| Id | Label | In | Out | Notes |
|----|-------|:--:|:---:|-------|
| `azw` | AZW | ✓ | — | DRM-free only; prefer AZW3 out |
| `azw4` | AZW4 | ✓ | — | Print replica; poor reflow |
| `kepub` | KEPUB | ✓ | ✓ | Kobo EPUB variant |
| `lit` | LIT | ✓ | ✓ | |
| `lrf` | LRF | ✓ | ✓ | Sony |
| `pdb` | PDB | ✓ | ✓ | Palm variants vary |
| `pml` | PML | ✓ | — | Use PMLZ for output |
| `pmlz` | PMLZ | — | ✓ | Zipped PML |
| `rb` | RB | ✓ | ✓ | RocketEbook |
| `snb` | SNB | ✓ | ✓ | |
| `tcr` | TCR | ✓ | ✓ | |
| `txtz` | TXTZ | ✓ | ✓ | |
| `htmlz` | HTMLZ | ✓ | ✓ | Explicit HTMLZ (vs HTML→HTMLZ) |
| `chm` | CHM | ✓ | — | Large/complex CHMs may fail |
| `fbz` | FBZ | ✓ | — | Zipped FB2 |

### Comics / scans

| Id | Label | In | Out | Notes |
|----|-------|:--:|:---:|-------|
| `cbz` | CBZ | ✓ | — | Comic ZIP; image-based |
| `djvu` | DjVu | ✓ | — | Best with embedded OCR text |

### Office extras

| Id | Label | In | Out | Notes |
|----|-------|:--:|:---:|-------|
| `odt` | ODT | ✓ | — | OpenDocument text |

## Still blocked (registered, disabled)

| Id | Label | Why |
|----|-------|-----|
| `cbr` | CBR | Needs **unrar** in the converter image — use **CBZ** instead |
| `pptx` | PPTX | `ebook-convert` does not accept PowerPoint |
| `csv` | CSV | `ebook-convert` does not accept CSV |
| `svg` | SVG | Not a standard ebook-convert path |
| `tex` | LaTeX | Not supported by ebook-convert |
| `rst` | reStructuredText | Not supported by ebook-convert |
| `org` | Org-mode | Not supported by ebook-convert |

Intentionally **not** in the product catalog as convertible books: MP3, XLSX, KFX (DRM), iBooks, MBP, NCX, OPF-as-book, etc.

## How enablement works

1. Edit `FORMATS` in `packages/shared/src/formats.ts` (`enabled()` vs `blocked()`).
2. Mirror suffixes in `converter/server.py` `INPUT_EXT` / `OUTPUT_EXT`.
3. Rebuild: `npm run build -w @epub/shared` (and web).

See also `docs/plugins.md`.
