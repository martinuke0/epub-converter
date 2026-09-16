# Custom .dev Domain for EPUB Converter

**Current URL:** https://epub-converter.rubicon.workers.dev  
**Target:** A clean `.dev` domain via Cloudflare Registrar

---

## 1. Domain Name Candidates

Check these in order of preference — some may already be registered:

| Domain | Notes |
|---|---|
| `epubconvert.dev` | Exact match for the app's purpose |
| `epubconverter.dev` | Slightly longer but very explicit |
| `epub.dev` | Short, premium — likely taken or expensive |
| `bookconvert.dev` | Broader appeal, format-agnostic |
| `readconvert.dev` | Unique, memorable |

Run availability checks before committing to a name (see §2).

---

## 2. Check Availability

**Option A — Cloudflare Dashboard (easiest):**
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Domain Registration** → **Register Domains**
2. Type each candidate — the dashboard shows availability and at-cost price instantly

**Option B — CLI whois:**
```bash
whois epubconvert.dev | grep -i "domain status\|registrar"
# AVAILABLE if you see "No match for domain" or status: free
```

**Option C — Wrangler (custom domains list only, not search):**
```bash
npx wrangler domains list
# Shows currently attached domains; doesn't search registrar inventory
```

---

## 3. Purchase via Cloudflare Registrar

1. **Login** → [dash.cloudflare.com](https://dash.cloudflare.com) → **Domain Registration** → **Register Domains**
2. Search for your chosen `.dev` name
3. Click **Purchase** — Cloudflare charges at-cost (no markup)
4. Complete payment — card on file or add one
5. The domain is auto-added to your Cloudflare account with:
   - Cloudflare nameservers (already set, no NS change needed)
   - Auto-renew enabled (recommended — `.dev` HSTS means losing it breaks the site for visitors)
6. Confirm domain appears under **Websites** in the dashboard

> Cloudflare is an ICANN-accredited registrar. `.dev` domains are managed by Google Registry. Cloudflare passes through the registry cost with zero markup.

---

## 4. Wire the Domain to the Worker

### Option A — wrangler.toml (recommended, tracked in git)

Add a `routes` block with `custom_domain = true` to `wrangler.toml`:

```toml
# Epub — Cloudflare Worker + Containers + R2 + Static Assets
# Deploy: npm run build:web && npx wrangler deploy

name = "epub-converter"
main = "apps/api/functions/worker.ts"
compatibility_date = "2025-09-16"
compatibility_flags = ["nodejs_compat"]
workers_dev = true

[[routes]]
pattern = "epubconvert.dev"
custom_domain = true

[[routes]]
pattern = "www.epubconvert.dev"
custom_domain = true
```

Then redeploy:
```bash
npm run build:web
npx wrangler deploy
```

### Option B — Dashboard (no redeploy needed)

1. **Workers & Pages** → select **epub-converter** Worker
2. **Settings** → **Domains & Routes** → **Add Custom Domain**
3. Enter `epubconvert.dev` → Cloudflare creates a DNS CNAME and issues a TLS cert automatically
4. Repeat for `www.epubconvert.dev` if desired

> Both options are equivalent. Option A is preferred so domain config lives in version control.

---

## 5. Why .dev Is Ideal for This App

**HTTPS enforcement (HSTS preload):**  
`.dev` is on the HSTS preload list maintained by Google. Every major browser enforces HTTPS for all `.dev` domains at the browser level — no HTTP fallback is possible. For an app where users upload personal ebook files, this is a meaningful privacy guarantee with zero extra config.

**Cloudflare synergy:**  
Cloudflare is both the registrar and the DNS provider. Domain purchase → DNS record → TLS cert → Worker routing all happen within one system. DNS propagation is near-instant (no external NS delegation).

**Brand clarity:**  
`.dev` signals a developer tool. EPUB conversion is a technical workflow — the TLD matches the audience.

**No mixed-content risk:**  
Assets, API calls, and file uploads all go over HTTPS by definition. The Container sidecar traffic stays internal to Cloudflare's network.

---

## 6. Cost Estimate

| Item | Cost |
|---|---|
| `.dev` registration (year 1) | ~$12–15 USD |
| Annual renewal | Same at-cost rate, no markup |
| TLS certificate | Free (Cloudflare Universal SSL) |
| DNS hosting | Free (included with Cloudflare account) |
| Custom domain routing on Workers | Free tier covers it |

> Cloudflare Registrar pricing: https://www.cloudflare.com/products/registrar/

---

## 7. Post-Purchase Checklist

After purchase and `wrangler deploy`:

- [ ] `curl -I https://epubconvert.dev` returns `HTTP/2 200` (not a redirect loop)
- [ ] `curl -I http://epubconvert.dev` returns `307` or browser blocks it (HSTS working)
- [ ] Upload a small `.epub` file and confirm conversion completes end-to-end
- [ ] Upload a small `.mobi` / `.pdf` and verify the Calibre container spins up correctly
- [ ] Check Cloudflare dashboard → **Workers & Pages** → epub-converter → **Metrics** — requests should show the custom domain
- [ ] `npx wrangler domains list` shows the new domain attached
- [ ] Update `README.md` with the new URL
- [ ] Update any hardcoded `workers.dev` references in the codebase:
  ```bash
  grep -r "workers.dev" /Users/user/epubconverted/epub-converter/apps
  ```
- [ ] Set calendar reminder for renewal (or confirm auto-renew is on in CF dashboard)
