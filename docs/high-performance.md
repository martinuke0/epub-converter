# High performance without a huge footprint

Practical notes for running Epub under traffic while keeping **disk / R2** small and costs predictable. Calibre conversions are CPU- and memory-heavy; the goal is honest capacity, not fake infinite scale.

## Principles

1. **No long retention** — uploads and outputs are ephemeral. Delete after convert (or short TTL).
2. **Stage, don’t archive** — R2 is a temporary buffer for Worker ↔ Container handoff, not a library.
3. **Bound concurrency** — GuardPlugins (rate limit + max concurrent) protect the Calibre pool before disks fill.
4. **Prefer warm capacity you can afford** — cold starts are normal; oversizing warm pools burns money.

## Cold containers vs warm pool

| Mode | Latency | Cost | When |
|------|---------|------|------|
| **Cold** | First request pays boot (Calibre + Xvfb); can be tens of seconds | Low idle cost; `sleepAfter` lets instances sleep | Low / bursty traffic |
| **Warm pool** | Faster steady converts | Pay for idle `max_instances` × instance size | Sustained traffic, SLAs |

Config lives in `wrangler.toml`:

- `[[containers]].max_instances` — upper bound on parallel Calibre sidecars (keep aligned with Worker pool size in `worker.ts`).
- `instance_type` (e.g. `standard-2`) — Calibre wants RAM; undersizing → OOM / slow thrash.
- Container `sleepAfter` (in code) — how long to keep an instance warm after last use.

**UI honesty (P3):** poll `/api/health`. If the converter is not ok, show “Warming converter…” and stages (`checking → warming → uploading → converting → downloading`). Do not invent progress bars for cold start.

**Tradeoff:** raising `max_instances` and lengthening `sleepAfter` cuts p95 latency but increases always-on (or nearly always-on) cost. Start small (2–3), measure 429s / queue depth, then scale.

## R2 footprint

- Bind `UPLOADS` only as **staging**. Worker writes `tmp/<uuid>`, converts, **deletes in `finally`**.
- Do not add lifecycle “keep forever” rules for this bucket.
- Optional: R2 object lifecycle (e.g. abort incomplete / delete after 1 day) as a **safety net** if a Worker crashes mid-request — still treat delete-after-convert as primary.
- Avoid storing converted downloads in R2 for the happy path; stream the Container response back to the client when possible.

Local Compose uses a temp dir with TTL cleanup (`TEMP_TTL_SECONDS`); same idea — expire, don’t accumulate.

## Streaming

- Prefer returning the upstream conversion body as a `Response` stream (Worker already forwards `res.body`) instead of buffering entire outputs in Worker memory when the runtime allows.
- Multipart upload still buffers the incoming `File` for FormData / R2 put — keep **`MAX_FILE_SIZE_MB`** tight (default 80) so one request cannot pin large memory + disk.
- GuardPlugins reject oversized bodies with **413** before work starts.

## Rate limits & concurrency (P0)

Production multi-isolate Workers **must not** rely on in-memory counters. Use the `RATE_LIMIT` KV binding (see README):

| Guard | Default idea | Effect |
|-------|----------------|--------|
| Per-IP rate limit | N converts / window | Stops abuse spikes |
| Max concurrent (per-IP + global) | e.g. 2 / 5 | Matches container pool; returns **429** when busy |
| File size | `MAX_FILE_SIZE_MB` | **413** |
| Optional `ACCESS_TOKEN` | private mode | **401** |

Tune via vars: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SEC`, `MAX_CONCURRENT_PER_IP`, `MAX_CONCURRENT_GLOBAL`.

When global concurrent is saturated, clients should retry after `Retry-After` — better than queueing unbounded work onto disk.

## Instance sizing vs cost

Calibre is the bottleneck, not the Vite UI.

- **Too small** → failed converts, retries, *more* wasted bytes and time.
- **Too large** → idle RAM bill.
- Rule of thumb: size so a typical EPUB→PDF finishes without swap; use `standard-2` (or larger) as in this repo; drop to `standard-1` only after measuring real books.

Align `MAX_CONCURRENT_GLOBAL` ≤ effective container capacity so the API fails fast with 429 instead of stacking jobs.

## Workers Builds path

Recommended production path: push to `main` → Cloudflare Workers Builds runs:

```bash
npm run build:web && npx wrangler deploy
```

That builds the UI, Worker, and Container image in Cloudflare (no laptop Docker required). After deploy:

1. Confirm R2 buckets + KV `RATE_LIMIT` ids are real (not stubs).
2. Wait for first container provision / cold start; hit `/api/health`.
3. Watch 429 rates and container metrics before raising pool size.

## Checklist for “busy but lean”

- [ ] R2 delete after every convert; short lifecycle safety net
- [ ] KV rate limit + concurrent guards enabled
- [ ] `max_instances` and concurrent guards agree
- [ ] `MAX_FILE_SIZE_MB` enforced in Worker + sidecar
- [ ] Cold-start UX (no fake progress)
- [ ] No long-lived user file storage in the default product

Plugins configure and guard this behavior; they do not replace Calibre unless you explicitly use a stub for local dev.
