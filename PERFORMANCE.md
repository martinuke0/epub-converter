# EPUB Converter — Performance & Scalability Plan

## Current Architecture

| Component | Details |
|-----------|---------|
| Worker | Cloudflare Worker (nodejs_compat) |
| Converter | `CalibreConverter` Container — `standard-2`, `max_instances = 3` |
| Storage | R2 (`epub-converter-tmp`) — put → convert → delete |
| Static assets | Vite build via `ASSETS` binding (Workers CDN) |
| Max file size | 80 MB |
| Conversion time | 5–60 s depending on format and file size |
| Container idle | `sleepAfter = 15m` |

---

## 1. Current Bottlenecks

### Container cold start (~3–5 s)
Calibre's Python runtime initialises on first request after sleep. A 3-instance pool
means up to 3 concurrent conversions without queuing, but after 15 minutes of
inactivity all containers sleep simultaneously — the next burst hits cold starts on
every slot.

### Single R2 round-trip
Every conversion does: `PUT object → container reads object → DELETE object`.
At 80 MB and Workers free egress, this adds ~200–800 ms of R2 latency. Not a
bottleneck at low volume, but worth noting for large files.

### No request queue
Requests beyond 3 concurrent conversions fail immediately (or wait on the DO stub).
There is no backpressure, retry logic, or async job model — acceptable at low traffic,
brittle above ~50 req/hour peak.

---

## 2. Traffic Tiers

### Tier 1 — 0–100 req/day (current)
Current setup is appropriate.

- 3 containers handle any realistic burst at this volume.
- Containers sleep between bursts — cold starts are rare and tolerable.
- R2 costs are negligible (< $0.01/month at 80 MB × 100 conversions).
- No changes required.

### Tier 2 — 100–1 000 req/day

**Changes:**
1. Increase `max_instances` to 5 in `wrangler.toml`.
2. Add a cron health pre-warm (see §6) to keep at least 1 container warm.
3. Add in-Worker concurrency guard (see §4a) to shed load gracefully.

```toml
# wrangler.toml
[[containers]]
class_name = "CalibreConverter"
image      = "./converter/Dockerfile"
instance_type = "standard-2"
max_instances = 5        # was 3
```

### Tier 3 — 1 000–10 000 req/day

Synchronous conversion becomes a UX liability. Switch to an async job model.

**Changes:**
1. Add a **Cloudflare Queue** (`epub-conversion-jobs`) — worker enqueues, container
   consumer processes, result written back to R2.
2. Add `GET /api/status/:jobId` polling endpoint.
3. Update the frontend to poll every 2 s until `status: done` and then fetch the
   download URL.
4. Keep a lightweight KV store for job state (`PENDING | PROCESSING | DONE | ERROR`).

```toml
# wrangler.toml additions
[[queues.producers]]
binding   = "CONVERSION_QUEUE"
queue     = "epub-conversion-jobs"

[[queues.consumers]]
queue                     = "epub-conversion-jobs"
max_batch_size            = 5
max_batch_timeout         = 30
max_retries               = 2
dead_letter_queue         = "epub-conversion-dlq"

[[kv_namespaces]]
binding    = "JOB_STATE"
id         = "<kv-namespace-id>"
```

```ts
// Enqueue in Worker
await env.CONVERSION_QUEUE.send({ jobId, r2Key, targetFormat });
return Response.json({ jobId, status: "pending" });

// Poll endpoint
const state = await env.JOB_STATE.get(jobId, { type: "json" });
return Response.json(state ?? { status: "not_found" });
```

### Tier 4 — 10 000+ req/day

- Dedicated container fleet with separate queues per format (EPUB, PDF, etc.).
- Separate read (status/download) and write (upload/enqueue) Worker routes —
  allows independent scaling and rate limiting.
- Consider Cloudflare Workers for Platforms for per-tenant isolation if offering
  this as a SaaS API.
- R2 bucket lifecycle rules to hard-delete objects older than 1 hour as a safety net
  (see §3).

---

## 3. Space Efficiency & GDPR

The current design already deletes R2 objects immediately after conversion — no
persistent user data is retained. Two additional safety nets are recommended:

**R2 object TTL lifecycle rule** (catches crashes before DELETE runs):

```bash
npx wrangler r2 bucket lifecycle set epub-converter-tmp \
  --rule '{"id":"auto-expire","filter":{},"expiration":{"days":1}}'
```

**No user accounts, no logs with PII** — the Worker should not log filenames or
file content. Log only: job ID, format pair, duration, status code.

This makes the service GDPR-friendly by design: there is nothing to delete on a
data-subject request.

---

## 4. Rate Limiting Options

### a. In-Worker concurrent job counter (free, best-effort)

Uses a module-level `Map` in the Worker isolate. Accurate within one isolate;
does not coordinate across isolates (Cloudflare may run multiple).

```ts
const inFlight = new Map<string, number>(); // instanceId → count
const MAX_CONCURRENT = 3;

export default {
  async fetch(req, env) {
    const current = inFlight.get("global") ?? 0;
    if (current >= MAX_CONCURRENT) {
      return new Response("Too Many Requests", { status: 429 });
    }
    inFlight.set("global", current + 1);
    try {
      return await handleConvert(req, env);
    } finally {
      inFlight.set("global", (inFlight.get("global") ?? 1) - 1);
    }
  }
};
```

Cost: free. Accuracy: ~70% (misses cross-isolate bursts).

### b. Cloudflare WAF Rate Limiting rule (dashboard)

Available on the Workers $5/month plan. Set a rule on `(http.request.uri.path eq "/api/convert")`:

- Threshold: 10 requests / 60 s per IP
- Action: Block (returns 429)

Cost: ~$5/month (plan upgrade). Accuracy: exact, enforced at the edge before the
Worker runs. No code changes needed.

### c. RateLimit Durable Object binding (accurate, code-level)

Use a single Durable Object as a global counter. Accurate across all isolates.

```toml
[[durable_objects.bindings]]
name       = "RATE_LIMITER"
class_name = "RateLimiter"

[[migrations]]
tag                = "v2"
new_sqlite_classes = ["RateLimiter"]
```

```ts
export class RateLimiter extends DurableObject {
  async check(key: string, limit: number, windowMs: number): Promise<boolean> {
    const now = Date.now();
    const row = await this.ctx.storage.get<{count:number,reset:number}>(key);
    if (!row || now > row.reset) {
      await this.ctx.storage.put(key, { count: 1, reset: now + windowMs });
      return true;
    }
    if (row.count >= limit) return false;
    await this.ctx.storage.put(key, { count: row.count + 1, reset: row.reset });
    return true;
  }
}
```

Cost: DO requests billed at standard rate (~$0.15/million after free tier).
Accuracy: exact.

**Recommendation**: start with (a), upgrade to (b) when on the $5 plan, add (c)
only if per-IP rate limiting by code is required.

---

## 5. CDN for Static Assets

Nothing to do. The `ASSETS` binding serves the Vite build through Cloudflare's
global CDN automatically — cache-control headers, compression, and edge caching
are handled by the platform. Ensure the Vite build sets correct asset fingerprints
(default Vite behaviour) so CDN cache busting works on deploy.

---

## 6. Cold-Start Mitigation

Add a cron trigger that hits `/api/health` every 10 minutes. This keeps at least
one container in the pool warm, eliminating cold starts for the first request of
any burst.

```toml
# wrangler.toml
[triggers]
crons = ["*/10 * * * *"]   # every 10 minutes
```

```ts
// worker.ts
export default {
  async scheduled(_event, env, _ctx) {
    // Wake one container instance
    const stub = env.CALIBRE_CONVERTER.get(
      env.CALIBRE_CONVERTER.idFromName("warm-0")
    );
    await stub.fetch("http://internal/health").catch(() => {});
  },
  async fetch(req, env) { /* ... */ }
};
```

The cron costs ~4 320 Worker invocations/month — well within the free tier
(100 000/day). It does not warm all 3 instances, but ensures p50 latency avoids
the cold-start penalty for typical single-user bursts.

---

## 7. Monitoring

**Built-in** (no action needed): Cloudflare Workers Analytics dashboard shows
request count, CPU time, error rate, and subrequest latency by route.

**Structured logging** — add to every conversion response path:

```ts
console.log(JSON.stringify({
  jobId,
  sourceFormat,
  targetFormat,
  fileSizeBytes,
  durationMs,
  status,         // "ok" | "error"
  errorCode,      // omit if ok
}));
```

Workers logs are queryable via `wrangler tail` in dev and via Workers Logpush
(available on $5 plan) to R2 or a third-party sink.

**Alert on p99 > 60 s**: set up a Cloudflare Notification (Workers & Pages →
Alerts) for CPU time exceeded, or export logs to Grafana/Datadog and alert on
`percentile(durationMs, 99) > 60000`.

---

## 8. Cost Estimate

All prices as of mid-2025. Cloudflare pricing is subject to change.

| Tier | req/day | Workers plan | Estimated monthly cost |
|------|---------|-------------|------------------------|
| 1 | 0–100 | Free | **$0** — Workers free tier (100k req/day), R2 free tier (10 GB·month) |
| 2 | 100–1k | Free or $5 | **$0–$5** — still within free tier request limits; $5 if WAF rate limiting wanted |
| 3 | 1k–10k | $5 | **~$10–$40** — $5 plan + Queues ($0.40/million messages) + KV writes + R2 ops |
| 4 | 10k+ | $5 or Enterprise | **$50–$200+** — depends on container CPU time billed, R2 egress, DO requests |

**Container costs** (standard-2 instance, billed per CPU-second):
- At 30 s average conversion and 1 000 req/day → ~30 000 CPU-seconds/day
- Cloudflare Containers pricing: check [developers.cloudflare.com/containers](https://developers.cloudflare.com/containers) for current rates; roughly $0.02–$0.05/CPU-hour at standard-2

**R2 costs** (at 80 MB avg, transient only):
- 1 000 req/day × 80 MB × 30 days = 2.4 TB transferred through R2
- R2 egress to Workers is free; Class A ops (PUT) at $0.0054/thousand = ~$0.16/month at Tier 3

**Bottom line**: the app runs free up to ~1 000 req/day. The $5/month Workers plan
unlocks WAF rate limiting and Logpush and is the first worthwhile upgrade.
Queues + async jobs are the only architectural change needed before 10k req/day.
