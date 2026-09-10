# Deploying to the shared VPS (Caddy)

The site was designed around Cloudflare Pages (`functions/go/[slug].ts` is a Cloudflare
Pages Function using Cloudflare-specific bindings). The static build works unchanged on
any host; only the `/go/` redirect needs a different mechanism, which is what
`scripts/build-caddy-site.ts` is for.

## What's already on the box (checked 2026-09-10)

- **Caddy** already owns ports 80 and 443. `/etc/caddy/Caddyfile` is a flat file — one
  global `{ }` options block, then one `{ }` block per site, no `import` directive
  anywhere — currently holding `app.claudich.dev`, `www.claudich.dev` and
  `claudich.dev`, another project entirely. Caddy issues and renews TLS certificates
  per site automatically; no certbot involved anywhere on this box.
- **Node 22.22.2, npm, git** already installed. Nothing to install for those.
- **No nginx anywhere.** Don't install it — Caddy already holds the ports it would want.
- The global Caddy options set `email admin@claudich.dev` for ACME — that's the other
  project's contact address, registered and working, and is left alone. The new site
  block below sets its own `tls sena4739686@gmail.com` line instead, which overrides
  the ACME contact for just that one block without touching the global option.
- `/home/claudich`, its Postgres role/database, and whatever `python -m app.main`
  (running as root) is are all someone else's. Docker/containerd are also running,
  presumably for something else again. **Don't stop, restart, or reconfigure any of
  these** — everything below only adds new, separate files and appends one new block
  to the Caddyfile.

Run every command over your own SSH session — nothing here executes itself.

## 1. Get the code onto the box, in its own directory

```bash
mkdir -p /var/www/gambleatlas
git clone https://github.com/Senya12345/peergift3 /var/www/gambleatlas
cd /var/www/gambleatlas
git checkout claude/install-grilling-skill-lpsr86
npm ci
```

## 2. Build for production

```bash
SITE_URL=https://gambleatlas.com SITE_INDEXABLE=true npm run build
npx tsx scripts/build-caddy-site.ts
```

`SITE_INDEXABLE=true` turns indexing on — the site has been sitting behind `noindex`
on purpose until there was enough content (see `src/lib/content.ts`). Nine casinos is
past the five-casino threshold the site owner set, so this is the intended moment to
flip it, not a default to reach for blindly on a later redeploy.

`scripts/build-caddy-site.ts` writes one complete, ready-to-append site block to
`deploy/gambleatlas-site.caddy` — security headers and `_astro/*` cache rule matching
the style of the existing `claudich.dev` block on this box, plus the `/go/{slug}`
redirects read from `functions/go/redirect-map.json`.

## 3. Append the block to the existing Caddyfile

```bash
cat deploy/gambleatlas-site.caddy   # sanity-check it before appending
cat deploy/gambleatlas-site.caddy >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
```

`caddy validate` catches a syntax mistake before it can affect the other project's
sites, which are in the same file. If it reports an error, fix `/etc/caddy/Caddyfile`
directly (the appended block is clearly delimited with `# --- gambleatlas.com --- ... #
--- end gambleatlas.com ---` comments) before going any further.

```bash
systemctl reload caddy
```

`reload`, not `restart` — re-reads config without dropping the other project's live
connections. TLS certs for gambleatlas.com/www.gambleatlas.com get issued automatically
the moment Caddy starts serving that block — nothing else to do for HTTPS, **as long as
the DNS A record already points at this server's IP** (see the DNS steps elsewhere in
this conversation — do that first if you haven't; propagation can take a few minutes to
an hour).

## Redeploying after a content or code change

```bash
cd /var/www/gambleatlas
git pull origin claude/install-grilling-skill-lpsr86
npm ci
SITE_URL=https://gambleatlas.com SITE_INDEXABLE=true npm run build
npx tsx scripts/build-caddy-site.ts
```

Only touch the Caddyfile again if the block's *content* actually changed (a new casino,
an updated `affiliateUrl`, or a header tweak) — most redeploys are just new static files
under `/var/www/gambleatlas/dist`, which Caddy serves immediately with no reload
needed. If it did change:

```bash
diff <(sed -n '/# --- gambleatlas.com ---/,/# --- end gambleatlas.com ---/p' /etc/caddy/Caddyfile) deploy/gambleatlas-site.caddy
```

shows exactly what's different. Replace that block in `/etc/caddy/Caddyfile` by hand
with the new `deploy/gambleatlas-site.caddy` contents, then `caddy validate` and
`systemctl reload caddy` again.

## Reading click counts without Cloudflare Analytics Engine

Caddy's default access log (JSON lines) records every request, `/go/{slug}` hits
included, once a `log` directive exists — check whether one already does with
`systemctl cat caddy` or by reading the Caddyfile's global block. If there isn't one,
add a `log { output file /var/log/caddy/gambleatlas.log }` line inside the new site
block, `caddy validate`, reload, then:

```bash
grep '"/go/' /var/log/caddy/gambleatlas.log | jq -r '.request.uri' | sort | uniq -c | sort -rn
```

This is a coarser signal than the Cloudflare Analytics Engine setup the code was
originally written for (no referer page or country breakdown pre-aggregated — both are
in the log line, just not summarised). GA4's `outbound_click` client-side event
(already wired in `src/components/Analytics.astro`) still fires normally on any host
once `PUBLIC_GA4_ID` is set at build time; it's just as blockable by ad blockers here as
it always was.
