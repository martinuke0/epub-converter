# Formats catalog

Shared source of truth: `packages/shared` (`FormatPlugin` registry + `FORMATS`).  
Calibre `ebook-convert` remains the engine; formats that Calibre cannot reliably handle stay **registered but disabled** (`canInput` / `canOutput` false) with a reason.

## Enabled now (v1 sublist)

These are wired for conversion (subject to same-format blocks and capability matrix):

| Id | Label | Input | Output | Notes |
|----|-------|:-----:|:------:|-------|
| `epub` | EPUB | ✓ | ✓ | Hero pair with PDF |
| `pdf` | PDF | ✓ | ✓ | PDF→ebook reflow varies |
| `mobi` | MOBI | ✓ | ✓ | |
| `azw3` | AZW3 | ✓ | ✓ | |
| `fb2` | FB2 | ✓ | ✓ | |
| `txt` | TXT | ✓ | ✓ | |
| `html` | HTML | ✓ | ✓ | Output is Calibre HTMLZ |
| `markdown` | Markdown | ✓ | — | Input only |
| `docx` | DOCX | ✓ | ✓ | |
| `rtf` | RTF | ✓ | ✓ | |

## Wishlist / coming soon (registered, disabled)

Registered as FormatPlugins so the UI and API can show “coming soon” without hardcoding. **Not** enabled for convert until Calibre (or a dedicated plugin path) is validated.

| Id | Label | Direction intent | Why disabled |
|----|-------|------------------|--------------|
| `cbz` | CBZ | in/out | Comic archives need different pipeline |
| `cbr` | CBR | in | RAR dependency / licensing |
| `djvu` | DjVu | in | Optional Calibre extra; heavy |
| `lit` | LIT | in | Legacy Microsoft Reader |
| `pdb` | PDB | in/out | Many Palm variants |
| `pml` | PML | in | Palm markup |
| `rb` | RB | in | RocketEbook legacy |
| `snb` | SNB | in/out | Shanda Bambook |
| `tcr` | TCR | in | Psion text compression |
| `txtz` | TXTZ | in/out | Zipped plain text package |
| `htmlz` | HTMLZ | in/out | Distinct from HTML→HTMLZ output mapping |
| `odt` | ODT | in/out | Needs stable round-trip checks |
| `svg` | SVG | in | Single-image / niche |
| `comic` | Comic (generic) | in | Prefer explicit CBZ |
| `mp3` | Audiobook MP3 | — | Out of scope (not ebook-convert) |
| `kepub` | KEPUB | out | Kobo variant; needs dedicated flags |
| `ibooks` | iBooks | — | Proprietary packaging |
| `lrf` | LRF | in/out | Sony legacy |
| `pmlz` | PMLZ | in | Zipped PML |
| `chm` | CHM | in | Windows help; security/size concerns |
| `pptx` | PPTX | in | Not a reading format |
| `xlsx` | XLSX | — | Out of scope |
| `csv` | CSV | — | Out of scope |
| `tex` | LaTeX | in | Fragile; optional later |
| `rst` | reStructuredText | in | Optional later |
| `org` | Org-mode | in | Optional later |
| `wiki` | Wiki markup | in | Optional later |
| `fbz` | FBZ | in | Zipped FB2 |
| `azw` | AZW (legacy) | in | Prefer AZW3; DRM often present |
| `azw4` | AZW4 | in | Print replica; poor reflow |
| `kfx` | KFX | — | DRM / proprietary |
| `tpz` | TPZ | in | Topaz legacy |
| `lrx` | LRX | — | Sony DRM |
| `mbp` | MBP | — | Kindle sidecar, not a book |
| `ncx` | NCX | — | TOC fragment, not a book |
| `opf` | OPF | in | Package metadata only |
| `nav` | NAV XHTML | — | EPUB3 fragment |

## How enablement works

1. Add or edit a `FormatPlugin` under `packages/shared` (see `docs/plugins.md`).
2. Set `canInput` / `canOutput` and optional `notes` / `comingSoon`.
3. Mirror extensions in `converter/server.py` when enabling for real converts.
4. Rebuild shared + web.

Disabled plugins stay in the registry for discovery (`formatRegistry.list()`) and documentation; the capability matrix and UI only offer enabled pairs.
