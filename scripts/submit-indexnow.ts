import fs from 'node:fs';
import path from 'node:path';

/**
 * Pings IndexNow with every indexable URL of the last build.
 *
 * IndexNow is a push protocol: instead of waiting for a crawler to come round, the site
 * tells Bing (and Yandex, Seznam, Naver — they share one endpoint) that specific URLs
 * changed. Google does not participate, so this speeds up everything except Google, which
 * is exactly the gap worth closing early: Bing has a far lower trust barrier for a new
 * domain, and it feeds Copilot and a good part of AI search.
 *
 * The URL list is read from the generated sitemap rather than by walking dist/, so the
 * same exclusions already apply — no /go/ redirects, no facet pages still under the
 * indexing threshold. A URL we deliberately keep out of the sitemap has no business being
 * pushed to a search engine either.
 */
const key = process.env.INDEXNOW_KEY;
const siteUrl = process.env.SITE_URL;

if (!key) {
  console.error('submit-indexnow: INDEXNOW_KEY is not set. Nothing submitted.');
  process.exit(1);
}
if (!siteUrl) {
  console.error('submit-indexnow: SITE_URL is not set. Nothing submitted.');
  process.exit(1);
}

const host = new URL(siteUrl).host;
const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  console.error('submit-indexnow: dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const sitemapFiles = fs
  .readdirSync(distDir)
  .filter((f) => f.startsWith('sitemap-') && f.endsWith('.xml') && f !== 'sitemap-index.xml');

if (sitemapFiles.length === 0) {
  console.error(
    'submit-indexnow: no sitemap in dist/. The site is likely built with SITE_INDEXABLE unset,\n' +
      '  which deliberately omits the sitemap. Nothing to submit.',
  );
  process.exit(1);
}

const urlList = [
  ...new Set(
    sitemapFiles.flatMap((file) =>
      [...fs.readFileSync(path.join(distDir, file), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1]?.trim())
        .filter((u): u is string => u !== undefined),
    ),
  ),
];

// A URL on another host is rejected for the whole batch (HTTP 422), so drop any before
// sending rather than losing the submission to one stray absolute link.
const foreign = urlList.filter((u) => new URL(u).host !== host);
const urls = urlList.filter((u) => new URL(u).host === host);

if (foreign.length > 0) {
  console.warn(`submit-indexnow: skipping ${foreign.length} URL(s) not on ${host}`);
}
if (urls.length === 0) {
  console.error('submit-indexnow: sitemap held no URLs for this host. Nothing submitted.');
  process.exit(1);
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${siteUrl.replace(/\/$/, '')}/${key}.txt`,
    urlList: urls,
  }),
});

// 200 is accepted; 202 means accepted but the key file has not been fetched and verified
// yet, which is the normal answer on a first submission rather than a problem.
if (response.status === 200 || response.status === 202) {
  const note = response.status === 202 ? ' (key pending verification — normal on first run)' : '';
  console.log(`submit-indexnow: submitted ${urls.length} URL(s) for ${host}${note}`);
} else {
  const body = await response.text();
  console.error(
    `submit-indexnow: endpoint returned ${response.status} ${response.statusText}\n${body}`,
  );
  process.exit(1);
}
