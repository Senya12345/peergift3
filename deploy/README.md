# Deploying to a plain VPS (nginx)

The site was designed around Cloudflare Pages (`functions/go/[slug].ts` is a Cloudflare
Pages Function using Cloudflare-specific bindings). On a generic VPS the static build
still works as-is; only the `/go/` redirect needs a different mechanism, which is what
`scripts/build-nginx-redirects.ts` and `deploy/nginx.conf.template` are for.

Run every command below over your own SSH session — nothing here executes itself.

## 0. Look before you touch anything

The box has other projects on it. Before installing or changing anything:

```bash
sudo nginx -t                        # is nginx already running, and is the config sane?
ls /etc/nginx/sites-enabled/         # what other sites are already configured
node -v                              # Node version, if any
which certbot
```

Everything below creates new, separate files and a new nginx server block. Nothing
existing gets edited.

## 1. Install what's missing

Only run the lines for what step 0 showed as absent.

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
# Node 20+ if node -v showed nothing or something older:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Get the code onto the box, in its own directory

```bash
sudo mkdir -p /var/www/gambleatlas
sudo chown $USER:$USER /var/www/gambleatlas
git clone https://github.com/Senya12345/peergift3 /var/www/gambleatlas
cd /var/www/gambleatlas
git checkout claude/install-grilling-skill-lpsr86
npm ci
```

## 3. Build for production

```bash
SITE_URL=https://gambleatlas.com SITE_INDEXABLE=true npm run build
npx tsx scripts/build-nginx-redirects.ts
```

`SITE_INDEXABLE=true` turns indexing on — the site has been sitting behind `noindex`
on purpose until there was enough content (see `src/lib/content.ts`). Nine casinos is
past the five-casino threshold the site owner set, so this is the intended moment to
flip it, not a default to reach for blindly on a later redeploy.

## 4. nginx site (HTTP first, certbot upgrades it to HTTPS)

```bash
sudo cp /var/www/gambleatlas/deploy/nginx.conf.template /etc/nginx/sites-available/gambleatlas.com
sudo ln -s /etc/nginx/sites-available/gambleatlas.com /etc/nginx/sites-enabled/gambleatlas.com
sudo nginx -t && sudo systemctl reload nginx
```

At this point `http://gambleatlas.com` should serve the site — **only once the DNS A
record points at this server's IP** (see the DNS section below; do that first if you
haven't).

## 5. HTTPS

```bash
sudo certbot --nginx -d gambleatlas.com -d www.gambleatlas.com -m sena4739686@gmail.com --agree-tos --redirect
```

`--redirect` makes certbot add the HTTP→HTTPS redirect itself. Certbot's systemd timer
renews automatically; confirm it exists with `systemctl list-timers | grep certbot`.

## Redeploying after a content or code change

```bash
cd /var/www/gambleatlas
git pull origin claude/install-grilling-skill-lpsr86
npm ci
SITE_URL=https://gambleatlas.com SITE_INDEXABLE=true npm run build
npx tsx scripts/build-nginx-redirects.ts
sudo nginx -t && sudo systemctl reload nginx   # reload, not restart — never drops a connection
```

## Reading click counts without Cloudflare Analytics Engine

Every `/go/{slug}` hit is a normal nginx access-log line. A quick per-casino count:

```bash
sudo awk '$7 ~ /^\/go\// {print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn
```

This is a coarser signal than the Cloudflare Analytics Engine setup the code was
originally written for (no referer page, no country breakdown out of the box — both
are in the log line if you want to parse further, just not aggregated). GA4's
`outbound_click` client-side event (already wired in `src/components/Analytics.astro`)
still fires normally on any host once `PUBLIC_GA4_ID` is set at build time; it's just
as blockable by ad blockers here as it always was.
