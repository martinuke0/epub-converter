# Plan: Buy a `.dev` domain on Cloudflare Registrar

Goal: give Epub a real hostname (not `*.workers.dev`) using [Cloudflare Registrar `.dev` domains](https://www.cloudflare.com/application-services/products/registrar/buy-dev-domains/), then attach it to the `epub-converter` Worker.

Related product docs:

- [Register a domain](https://developers.cloudflare.com/registrar/get-started/register-domain/)
- [Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## Why Cloudflare Registrar + `.dev`

- Domain DNS stays on Cloudflare — no third-party nameserver juggling.
- Worker **Custom Domains** auto-create DNS + TLS certificates.
- `.dev` is HSTS-preloaded (HTTPS-only by design) — good fit for an upload/convert app.
- Same account already runs the Worker, R2, and Containers.

## Suggested names (check live availability)

Pick 1–3 candidates and search in the dashboard (prices change; always confirm in UI):

| Idea | Notes |
|------|--------|
| `epub.dev` | Ideal if available (unlikely / premium) |
| `epubto.dev` / `epub2pdf.dev` | Clear product intent |
| `convertbook.dev` / `bookconvert.dev` | Broader than EPUB |
| `formatforge.dev` | Brandable if product name stays FormatForge-like |
| `getepub.dev` / `useepub.dev` | Short marketing |

Avoid: trademarks (Amazon Kindle, Adobe, etc.), lookalikes of big products.

## Phase 0 — Before you pay

1. Confirm Cloudflare account email is **verified** (required for Registrar).
2. Confirm billing profile exists (Registrar purchase).
3. Decide **apex** (`example.dev`) vs **www** (`www.example.dev`) vs **app** (`app.example.dev`).
   - Recommendation: apex + optional `www` redirect to apex (or the reverse — pick one canonical).
4. Keep `https://epub-converter.rubicon.workers.dev` as a fallback until the custom domain is green.

## Phase 1 — Register the domain

Dashboard path:

1. Cloudflare dashboard → **Domain registration** / **Register domains**  
   (product page: [Buy .dev domains](https://www.cloudflare.com/application-services/products/registrar/buy-dev-domains/)).
2. Search your candidates.
3. **Purchase** → choose term (1–10 years for most TLDs).
4. Confirm contacts + auto-renew preference.
5. Wait for confirmation email + zone to appear as **Active** on Cloudflare nameservers.

Notes:

- Cloudflare Registrar uses **Cloudflare nameservers only** (you cannot point the domain elsewhere while registered here).
- Internationalized (IDN / `xn--`) names are **not** supported by Cloudflare Registrar.
- Registration can take up to ~30s; DNS/zone activation is usually quick after that.

Optional API (beta): account Registrar endpoints can check availability/pricing (`domain-check`) and register — dashboard is enough for one domain.

## Phase 2 — Attach the Worker (Custom Domain)

Do **not** manually invent random CNAMEs if you use Custom Domains — Cloudflare does it.

### Dashboard (simplest)

1. **Workers & Pages** → **epub-converter** → **Settings** → **Domains & Routes**.
2. **Add** → **Custom Domain**.
3. Enter `yourname.dev` (and/or `www.yourname.dev`).
4. **Add Custom Domain** — Cloudflare creates DNS + certs.

### Wrangler (keep in repo after it works)

```toml
# wrangler.toml — example only; replace with the real hostname
[[routes]]
pattern = "yourname.dev"
custom_domain = true

# optional second host
# [[routes]]
# pattern = "www.yourname.dev"
# custom_domain = true
```

Then deploy via Workers Builds (preferred) or `npx wrangler deploy`.

**Requirements:**

- Zone must be on this Cloudflare account and **Active**.
- Hostname must not already have a conflicting CNAME you manage by hand.

## Phase 3 — App / product checklist after DNS works

- [ ] Open `https://yourname.dev` — UI loads (SPA assets).
- [ ] `GET https://yourname.dev/api/health` — `converter.ok: true`.
- [ ] Smoke convert: small EPUB → PDF.
- [ ] Update README + any UI footer links from `*.workers.dev` → new domain.
- [ ] Optional: set canonical URL / OG tags once branding is final.
- [ ] Optional: redirect `www` ↔ apex with a tiny Worker route or Bulk Redirect.
- [ ] Confirm rate-limit / abuse guards still apply on the new host (same Worker).

## Phase 4 — Hardening (same day as launch)

- Turn on **auto-renew** for the domain.
- Lock / enable WHOIS privacy if offered for `.dev` on Cloudflare (check registrar UI).
- Keep Workers Builds production branch = `main`.
- Re-read `docs/high-performance.md` before sharing the domain publicly (rate limits, R2 TTL, container pool size).
- Consider a simple `ACCESS_TOKEN` or Turnstile before posting the link widely.

## Cost mental model

| Item | Notes |
|------|--------|
| Domain registration / renewal | Registry wholesale-ish via Cloudflare Registrar — **confirm live price in search** |
| DNS + TLS | Included with Cloudflare |
| Worker requests | Existing Workers plan |
| Containers (Calibre) | Dominant cost under traffic — see `docs/high-performance.md` |
| R2 | Staging only; delete after convert |

Buying the domain is cheap relative to Calibre container minutes if the link goes viral unprotected.

## Out of scope for this plan

- Moving the domain to another registrar later (possible but friction).
- Multi-region marketing sites on Pages separate from the Worker (can add later; Custom Domain can also target Pages if you split UI later).
- Email on the domain (Cloudflare Email Routing is a separate optional step).

## Decision log (fill in)

| Field | Value |
|-------|--------|
| Chosen domain | _TBD_ |
| Term (years) | _TBD_ |
| Canonical host | apex / www / app |
| Custom Domain added | date |
| Health check OK | date |
| Public launch | date |

## Done when

1. Domain is registered on Cloudflare Registrar.
2. Custom Domain serves the Epub Worker over HTTPS.
3. Health + one real EPUB→PDF succeed on the new host.
4. Docs/README point at the new URL.
