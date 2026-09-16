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

First build may take several minutes (downloads the official Calibre linux binary into `/opt/calibre`). The image is `linux/amd64` (same as Cloudflare Containers).

**Apple Silicon note:** Compose and Wrangler both build `linux/amd64`. On an M-series Mac that means QEMU emulation. The Dockerfile intentionally avoids Debian's `calibre` apt package (large dependency tree that often hits dpkg I/O errors under QEMU) and installs Calibre from the [official binary installer](https://calibre-ebook.com/download_linux) instead. Expect a slower first build; subsequent layers cache.

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

## Production deploy (recommended: Workers Builds)

Production does **not** need a random external Calibre host. The Worker routes `/api/*` to a **Cloudflare Container** running the same `converter/Dockerfile`, with **R2** for optional upload staging and **Workers Static Assets** for the UI.

### Recommended: Cloudflare Workers Builds

Workers Builds is the recommended production path. It builds and deploys from GitHub in Cloudflare's build environment, so Docker does **not** need to be installed or running on your laptop. Workers Builds can build the `converter/Dockerfile` referenced by `wrangler.toml`.

In the Cloudflare dashboard:

1. Open **Workers & Pages → epub-converter → Settings → Builds**.
2. Connect GitHub and select `martinuke0/epub-converter`.
3. Set the production branch to `main`.
4. Set the build/deploy command to:

   ```bash
   npm run build:web && npx wrangler deploy
   ```

5. Save and trigger a production build.

The build command creates `apps/web/dist`, then Wrangler publishes the Worker, static assets, and the Container configuration. Create the R2 buckets once before the first production conversion (see below). The public Workers Dev URL follows `https://epub-converter.<subdomain>.workers.dev`; the known live URL is https://epub-converter.rubicon.workers.dev.

### Local fallback: Worker and UI only

To publish the Worker and UI without rolling out the Container image, build the UI and run:

```bash
npm run build:web
npx wrangler deploy --containers-rollout=none
# or: npm run deploy:worker
```

This fallback is useful for checking Worker/UI changes when Docker is unavailable. Conversion routes that require Calibre will not work until a Container image is built and rolled out.

### Optional: direct full Container deploy from your laptop

Use this only when you specifically want to build and roll out the Container from a local machine. This path requires Docker; it is not needed for Cloudflare deploys triggered by Workers Builds.

#### Prerequisites

- Cloudflare account with Workers + Containers + R2 enabled
- `npx wrangler login` (or `CLOUDFLARE_API_TOKEN`)
- Docker running locally (Wrangler builds `linux/amd64` and pushes the image)
- Node 22+ recommended for current Wrangler (`nvm use 22` if you use nvm)
- On **Apple Silicon**, the amd64 container build runs under QEMU — allow extra time; see Local (Compose) Apple Silicon note above

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

After the first full Container deploy, wait several minutes before expecting conversions to succeed. The Worker URL may respond while Cloudflare is still provisioning containers. First requests to a sleeping container also incur a **cold start** (Calibre + Xvfb boot).

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

### Cloudflare setup checks

1. **Workers & Pages → epub-converter → Settings** — confirm the R2 `UPLOADS` binding and Container binding.
2. **Workers & Pages → Containers** — inspect instance health, metrics, and logs.
3. **R2** — confirm buckets `epub-converter-tmp` and `epub-converter-tmp-preview` exist.
4. Enable a custom domain on the Worker if desired.

For Git-based Cloudflare deploys, Docker is handled by Workers Builds. Only the optional direct CLI Container deploy above requires Docker locally.

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
| `npm run deploy` | `build:web` + `wrangler deploy` (full Containers deploy) |
| `npm run deploy:worker` | `build:web` + Worker/UI deploy without Container rollout |
| `docker compose up -d` | Local Calibre converter |

## License

MIT
