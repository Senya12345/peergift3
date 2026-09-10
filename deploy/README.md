# Deploying to the shared VPS (Caddy)

The site was designed around Cloudflare Pages (`functions/go/[slug].ts` is a Cloudflare
Pages Function using Cloudflare-specific bindings). The static build works unchanged on
any host; only the `/go/` redirect needs a different mechanism, which is what
`scripts/build-caddy-redirects.ts` and `deploy/Caddyfile.snippet.template` are for.

## What's already on the box (checked 2026-09-10)

- **Caddy** already owns ports 80 and 443 (`/etc/caddy/Caddyfile`), serving at least one
  other project. Caddy gets its own TLS certificates automatically per site block — no
  certbot needed here.
- **Node 22.22.2, npm, git** already installed. Nothing to install for those.
- **No nginx anywhere.** Don't install it — Caddy already holds the ports it would want.
- `/home/claudich` is another project's home directory (its own Node backend + a
  Postgres role/database also called `claudich`, both with running processes). `python -m
  app.main` running as root is a third thing. Docker/containerd are also running,
  presumably for something else again. **Don't stop, restart, or reconfigure any of
  these** — everything below only adds new, separate files.

Run every command over your own SSH session — nothing here executes itself.

## 1. Look at the existing Caddyfile before touching it

```bash
cat /etc/caddy/Caddyfile
systemctl status caddy --no-pager
```

Paste that back if you want a second opinion before editing — specifically whether it
already has an `import /etc/caddy/conf.d/*` line (some setups split each site into its
own file that way; if so, dropping a new file in there is even less invasive than
editing the Caddyfile directly).

## 2. Get the code onto the box, in its own directory

```bash
mkdir -p /var/www/gambleatlas
git clone https://github.com/Senya12345/peergift3 /var/www/gambleatlas
cd /var/www/gambleatlas
git checkout claude/install-grilling-skill-lpsr86
npm ci
```

## 3. Build for production

```bash
SITE_URL=https://gambleatlas.com SITE_INDEXABLE=true npm run build
npx tsx scripts/build-caddy-redirects.ts
```

`SITE_INDEXABLE=true` turns indexing on — the site has been sitting behind `noindex`
on purpose until there was enough content (see `src/lib/content.ts`). Nine casinos is
past the five-casino threshold the site owner set, so this is the intended moment to
flip it, not a default to reach for blindly on a later redeploy.

## 4. Add the site to Caddy

```bash
cat deploy/go-redirects.caddy   # the redirect lines generated in step 3
```

Open `/etc/caddy/Caddyfile` in an editor and **append** (don't replace anything) the
block from `deploy/Caddyfile.snippet.template`, pasting the contents of
`deploy/go-redirects.caddy` in place of the comment inside it. Then:

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

`caddy validate` catches a syntax mistake before it can affect the other site already
running. `reload`, not `restart` — it re-reads config without dropping the other
project's live connections. HTTPS certs for gambleatlas.com/www.gambleatlas.com get
issued automatically the first time Caddy serves that block — nothing else to do,
**as long as the DNS A record already points at this server** (see the DNS section
elsewhere in this conversation — do that first if you haven't).

## Redeploying after a content or code change

```bash
cd /var/www/gambleatlas
git pull origin claude/install-grilling-skill-lpsr86
npm ci
SITE_URL=https://gambleatlas.com SITE_INDEXABLE=true npm run build
npx tsx scripts/build-caddy-redirects.ts
```

Only re-run the "Add the site to Caddy" step above if the redirect destinations
actually changed (a new casino, or an updated `affiliateUrl`) — `deploy/go-redirects.caddy`
regenerates every time but the Caddyfile block itself only needs re-pasting when its
content differs.

## Reading click counts without Cloudflare Analytics Engine

Caddy's default access log (JSON lines) records every request, `/go/{slug}` hits
included. Find the log path with `systemctl cat caddy` or check for an explicit `log`
block in the Caddyfile, then:

```bash
grep '"/go/' /var/log/caddy/access.log | jq -r '.request.uri' | sort | uniq -c | sort -rn
```

(swap the log path for whatever step 1 showed; if the Caddyfile has no `log` directive,
add one to the new site block before this becomes useful, and reload again).

This is a coarser signal than the Cloudflare Analytics Engine setup the code was
originally written for (no referer page or country breakdown pre-aggregated — both are
in the log line, just not summarised). GA4's `outbound_click` client-side event
(already wired in `src/components/Analytics.astro`) still fires normally on any host
once `PUBLIC_GA4_ID` is set at build time; it's just as blockable by ad blockers here as
it always was.
