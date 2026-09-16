# Epub

**Convert ebooks without the clutter.**

A calm, modern web app for converting ebooks and documents. Built with Vite + React + TypeScript, a Hono API (local), and a Calibre `ebook-convert` Docker sidecar. Production runs on **Cloudflare Workers + Containers + R2** — no external Calibre host required.

## Features

- Drag-and-drop multi-file queue
- Smart format picker (only valid targets enabled)
- Advanced options: PDF page size, margins, embed fonts, TOC, metadata, image DPI/quality
- Dark / light theme
- 80MB size limit; temp files deleted after TTL / download
- Pluggable converter: local Docker Compose → Cloudflare Containers in production

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
apps/web                 Vite + React + Tailwind UI
apps/api                 Hono Node API (local `npm run dev`)
apps/api/functions       Cloudflare Worker + Calibre Container class
packages/shared          Format matrix, options, limits
converter/               Calibre HTTP sidecar (Flask + ebook-convert)
docker-compose.yml       Local Calibre (unchanged for npm run dev)
wrangler.toml            Worker + Containers + R2 + static assets
```

---

## Local (Compose)

Use this path for day-to-day development. It does **not** use Cloudflare Containers.

### Prerequisites

- Node.js 20+ (22+ recommended for latest Wrangler)
- Docker & Docker Compose
- npm

### 1. Install

```bash
cd epub-converter
npm install
```

### 2. Start Calibre converter

```bash
docker compose up -d --build
# health: curl http://localhost:8090/health
```

First build may take several minutes (Calibre image). The image is `linux/amd64` (same as Cloudflare Containers).

### 3. Start UI + API

```bash
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:8787
- Converter: http://localhost:8090

The Vite dev server proxies `/api` → the Hono API. The Hono API talks to Compose via `CONVERTER_URL=http://localhost:8090`.

### Environment

Copy `.env.example` if needed:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8787` | API port |
| `CONVERTER_URL` | `http://localhost:8090` | Calibre sidecar (local) |
| `MAX_FILE_SIZE_MB` | `80` | Upload limit |
| `TEMP_TTL_SECONDS` | `3600` | Temp file lifetime |
| `ALLOW_STUB` | unset | If `true`, API returns labeled stub text when Calibre is down (dev only) |

### Sample conversion test

```bash
node scripts/make-sample-epub.mjs

curl -F "file=@samples/sample.epub" -F "from=epub" -F "to=pdf" \
  -o /tmp/sample.pdf http://localhost:8090/convert

curl -F "file=@samples/sample.epub" -F "from=epub" -F "to=pdf" \
  -o /tmp/sample-api.pdf http://localhost:8787/api/convert
```

### Local architecture

```
Browser → Vite (/api proxy) → Hono API → HttpConverter → Docker Compose Calibre (:8090)
```

---

## Cloudflare Containers deploy

Production does **not** need a random external Calibre host. The Worker routes `/api/*` to a **Cloudflare Container** running the same `converter/Dockerfile`, with **R2** for optional upload staging and **Workers Static Assets** for the UI.

### Prerequisites

- Cloudflare account with Workers + Containers + R2 enabled
- `npx wrangler login` (or `CLOUDFLARE_API_TOKEN`)
- **Docker running locally** at deploy time — required when `image` in `wrangler.toml` is a Dockerfile path (Wrangler builds `linux/amd64` and pushes to the Cloudflare registry)
- Node 22+ recommended for current Wrangler

### 1. Create R2 buckets (once)

```bash
npx wrangler r2 bucket create epub-converter-tmp
npx wrangler r2 bucket create epub-converter-tmp-preview
# or: npm run cf:r2:create
```

### 2. Build the web UI

```bash
npm run build:web
```

Output: `apps/web/dist` (served via `[assets]` in `wrangler.toml`).

### 3. Deploy Worker + Container

```bash
npx wrangler deploy
# or: npm run deploy   # build:web + wrangler deploy
```

What this does:

1. Uploads the Worker (`apps/api/functions/worker.ts`)
2. Builds `converter/Dockerfile` for **linux/amd64** via Docker and pushes the image
3. Rolls out container instances (`CalibreConverter`, `instance_type = standard-2`, up to 3)
4. Publishes static assets from `apps/web/dist`

### 4. Wait for cold start / provisioning

After the first deploy, wait several minutes before expecting conversions to succeed. The Worker URL may respond while Cloudflare is still provisioning containers. First requests to a sleeping container also incur a **cold start** (Calibre + Xvfb boot).

Check status:

```bash
npx wrangler containers list
npx wrangler containers images list
curl https://epub-converter.<YOUR_SUBDOMAIN>.workers.dev/api/health
```

### Production architecture

```
Browser → Worker (ASSETS for UI)
            └─ /api/convert → R2 stage (optional) → CALIBRE_CONVERTER Container (:8090/convert)
            └─ /api/health  → container /health
```

Config lives in `wrangler.toml`:

- `[[containers]]` → `class_name = "CalibreConverter"`, `image = "./converter/Dockerfile"`
- `[[durable_objects.bindings]]` → `CALIBRE_CONVERTER`
- `[[r2_buckets]]` → `UPLOADS`
- `[assets]` → `apps/web/dist`, `run_worker_first = ["/api/*"]`

Optional: set `CONVERTER_URL` as a Worker var only if you want an external Calibre fallback. With Containers wired, you do **not** need it.

### Manual Cloudflare dashboard steps

Usually none beyond account login. Optionally:

1. **Workers & Pages → epub-converter → Settings** — confirm R2 `UPLOADS` binding and Container binding
2. **Workers & Pages → Containers** — inspect instance health, metrics, logs
3. **R2** — confirm buckets `epub-converter-tmp` and `epub-converter-tmp-preview` exist
4. Enable a custom domain on the Worker if desired

If Docker is unavailable on the machine running deploy, either start Docker, use Workers Builds (CI with Docker), or pre-build/push an image and point `image` at `registry.cloudflare.com/<ACCOUNT_ID>/...` instead of the Dockerfile path.

### Instance sizing note

Calibre is memory-heavy. This repo uses `instance_type = "standard-2"` (1 vCPU / 6 GiB / 12 GB disk). Adjust in `wrangler.toml` if needed (`standard-1` … `standard-4`, or a custom type).

---

## Privacy

- No accounts, no analytics in the default app.
- Local: uploads stay on the machine running the API / converter.
- Production: bytes pass through your Worker / R2 / Container on Cloudflare; temp R2 keys are deleted after conversion.
- Do not commit `.env`, `.dev.vars`, or real credentials.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | UI + Hono API (expects Compose Calibre) |
| `npm run build` | Build shared, web, api |
| `npm run build:web` | Shared + web only |
| `npm run deploy` | `build:web` + `wrangler deploy` (Containers) |
| `docker compose up -d` | Local Calibre converter |

## License

MIT
