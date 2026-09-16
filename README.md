# Epub

**Convert ebooks without the clutter.**

A calm, modern web app for converting ebooks and documents. Built with Vite + React + TypeScript, a Hono API, and a Calibre `ebook-convert` Docker sidecar. Cloudflare Pages / Workers / R2 ready.

## Features

- Drag-and-drop multi-file queue
- Smart format picker (only valid targets enabled)
- Advanced options: PDF page size, margins, embed fonts, TOC, metadata, image DPI/quality
- Dark / light theme
- 80MB size limit; temp files deleted after TTL / download
- Pluggable converter: local Docker Calibre → production `CONVERTER_URL`

## Format matrix

| Input → Output | EPUB | PDF | MOBI | AZW3 | FB2 | TXT | HTML | Markdown | DOCX | RTF |
|----------------|:----:|:---:|:----:|:----:|:---:|:---:|:----:|:--------:|:----:|:---:|
| **EPUB**       | —    | ✓   | ✓    | ✓    | ✓   | ✓   | ✓    | ✓        | ✓    | ✓   |
| **PDF**        | ✓    | —   | ✓    | ✓    | ✓   | ✓   | ✓    | ✓        | ✓    | ✓   |
| **MOBI**       | ✓    | ✓   | —    | ✓    | ✓   | ✓   | ✓    | ✓        | ✓    | ✓   |
| **AZW3**       | ✓    | ✓   | ✓    | —    | ✓   | ✓   | ✓    | ✓        | ✓    | ✓   |
| **FB2**        | ✓    | ✓   | ✓    | ✓    | —   | ✓   | ✓    | ✓        | ✓    | ✓   |
| **TXT**        | ✓    | ✓   | ✓    | ✓    | ✓   | —   | ✓    | ✓        | ✓    | ✓   |
| **HTML**       | ✓    | ✓   | ✓    | ✓    | ✓   | ✓   | —    | ✓        | ✓    | ✓   |
| **Markdown**   | ✓    | ✓   | ✓    | ✓    | ✓   | ✓   | ✓    | —        | ✓    | ✓   |
| **DOCX**       | ✓    | ✓   | ✓    | ✓    | ✓   | ✓   | ✓    | ✓        | —    | ✓   |
| **RTF**        | ✓    | ✓   | ✓    | ✓    | ✓   | ✓   | ✓    | ✓        | ✓    | —   |

Same-format pairs are disabled. **Hero pair: EPUB ↔ PDF.**

Notes:
- PDF → ebook reflow quality depends on the source PDF layout.
- HTML **output** is Calibre HTMLZ (zipped HTML package).
- Markdown is **input-only** (Calibre has no Markdown writer).

## Project layout

```
apps/web          Vite + React + Tailwind UI
apps/api          Hono Node API (dev + local prod)
packages/shared   Format matrix, options, limits
converter/        Calibre HTTP sidecar (Flask + ebook-convert)
docker-compose.yml
wrangler.toml     Cloudflare Pages + R2 stubs
```

## Local setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm

### 1. Install

```bash
cd epub-converter
npm install
```

### 2. Start Calibre converter

```bash
docker compose up -d
# health: curl http://localhost:8090/health
```

First build may take several minutes (Calibre image).

### 3. Start UI + API

```bash
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:8787  
- Converter: http://localhost:8090  

The Vite dev server proxies `/api` → the Hono API.

### Environment

Copy `.env.example` if needed:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | API port |
| `CONVERTER_URL` | `http://localhost:8090` | Calibre sidecar |
| `MAX_FILE_SIZE_MB` | `80` | Upload limit |
| `TEMP_TTL_SECONDS` | `3600` | Temp file lifetime |
| `ALLOW_STUB` | unset | If `true`, API returns labeled stub text when Calibre is down (dev only) |

### Sample conversion test

```bash
# Generate a tiny sample EPUB
node scripts/make-sample-epub.mjs

# EPUB → PDF via converter
curl -F "file=@samples/sample.epub" -F "from=epub" -F "to=pdf" \
  -o /tmp/sample.pdf http://localhost:8090/convert

# Or via API
curl -F "file=@samples/sample.epub" -F "from=epub" -F "to=pdf" \
  -o /tmp/sample-api.pdf http://localhost:8787/api/convert
```

## Architecture

```
Browser → Vite (/api proxy) → Hono API → Converter interface
                                            ├─ HttpConverter → Calibre Docker (:8090)
                                            └─ StubConverter (optional, labeled)
```

**Workers cannot run Calibre.** Production path:

1. Worker / Pages Function accepts upload  
2. Optional R2 staging (`UPLOADS` binding)  
3. Forwards to `CONVERTER_URL` (Calibre sidecar or future Cloudflare Container)  
4. Returns bytes; deletes temp objects  

See `apps/api/functions/worker.ts` and `wrangler.toml`.

## Cloudflare deploy

Config is ready; you still need a Cloudflare account and a live Calibre sidecar URL.

1. **Build the web app**

   ```bash
   npm run build:web
   ```

2. **Create R2 buckets**

   ```bash
   npx wrangler r2 bucket create epub-converter-tmp
   npx wrangler r2 bucket create epub-converter-tmp-preview
   ```

3. **Set secrets / vars** in the dashboard or:

   ```bash
   npx wrangler pages secret put CONVERTER_URL
   # value: https://your-calibre-sidecar.example.com
   ```

4. **Deploy Pages**

   ```bash
   npx wrangler pages deploy apps/web/dist --project-name=epub-converter
   ```

5. **Optional dedicated Worker** for `/api/*` using `apps/api/functions/worker.ts` — point Pages Functions or a Worker route at it, with `UPLOADS` R2 binding and `CONVERTER_URL`.

Until `CONVERTER_URL` points at a reachable Calibre service, production conversions will return 503.

## Privacy

- No accounts, no analytics in the default app.
- Uploads stay on the machine running the API / converter.
- Temp files are removed after download (API) and via TTL cleanup (API + converter).
- Do not commit `.env`, `.dev.vars`, or real credentials.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | UI + API together |
| `npm run build` | Build shared, web, api |
| `npm run build:web` | Shared + web only |
| `docker compose up -d` | Calibre converter |

## License

MIT
