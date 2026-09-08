import fs from 'node:fs';
import path from 'node:path';
import { loadCasinos } from '../src/lib/content';

/**
 * Emits the slug -> destination map consumed by functions/go/[slug].ts.
 *
 * Generated rather than hand-kept so it can never disagree with the content files, and
 * so swapping in an affiliate URL is a one-line edit to a casino record that the whole
 * site picks up on the next deploy.
 */
const map = Object.fromEntries(
  loadCasinos().map((casino) => [
    casino.slug,
    {
      url: casino.affiliateUrl ?? casino.url,
      // Recorded so click logs can distinguish earning traffic from placeholder traffic.
      affiliate: casino.affiliateUrl !== null,
    },
  ]),
);

const out = path.join(process.cwd(), 'functions/go/redirect-map.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(map, null, 2)}\n`);

console.log(`build-redirects: wrote ${Object.keys(map).length} destinations to ${out}`);
