import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Downloads every provider logo once and writes it into src/assets/providers/ as WebP
 * with the flat backdrop knocked out to transparency.
 *
 * Two reasons this exists rather than pointing <img> at the source CDN:
 *
 * 1. Hotlinking bills someone else for our traffic and breaks the day they add a referer
 *    check. Self-hosting is the only version of this that keeps working.
 * 2. The marks ship on a flat backdrop that belongs to the lobby they were cut for, not to
 *    this site. Once the file is local it can be fixed once, at import, instead of being
 *    papered over with a blend mode on every page that shows it.
 *
 * Run it wherever the network reaches the CDN — the build sandbox cannot, the VPS can:
 *
 *   npx tsx scripts/fetch-provider-logos.ts
 *
 * It skips anything already downloaded, so re-running after adding providers only fetches
 * the new ones. Commit the result; the site never touches the remote CDN at runtime.
 */

const root = process.cwd();
const outDir = path.join(root, 'src/assets/providers');
const registry = path.join(root, 'src/content/providers.json');

/** Twice the size Stake serves in its own grid, so the tiles stay sharp on retina. */
const WIDTH = 338;
const HEIGHT = 134;

/**
 * How far a pixel may sit from the sampled backdrop colour and still count as backdrop.
 * Generous enough for the JPEG-ish fringing around anti-aliased edges, tight enough not to
 * eat a logo that happens to be a similar grey.
 */
const TOLERANCE = 26;

interface Entry {
  slug: string;
  name: string;
  logo: string | null;
}

const providers = JSON.parse(fs.readFileSync(registry, 'utf8')) as Entry[];
const base =
  (JSON.parse(fs.readFileSync(path.join(root, 'scripts/seed/stake-providers.json'), 'utf8')) as {
    logoBase: string;
  }).logoBase;

fs.mkdirSync(outDir, { recursive: true });

/**
 * Replaces the backdrop with transparency.
 *
 * The backdrop colour is sampled from the corners rather than hard-coded, because it is a
 * property of whatever exported the asset and differs between sources. If the corners
 * disagree with each other the image has real artwork running to its edge, and it is left
 * alone rather than punched full of holes. An image that already carries useful alpha is
 * also left alone.
 */
async function knockOutBackdrop(input: Buffer): Promise<Buffer> {
  const image = sharp(input).resize(WIDTH, HEIGHT, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const at = (x: number, y: number) => (y * width + x) * channels;
  const corners = [
    at(0, 0),
    at(width - 1, 0),
    at(0, height - 1),
    at(width - 1, height - 1),
  ];

  // Already transparent at the edges: nothing to strip.
  if (corners.every((i) => data[i + 3]! < 8)) {
    return sharp(data, { raw: info }).webp({ quality: 90 }).toBuffer();
  }

  const sample = corners.map((i) => [data[i]!, data[i + 1]!, data[i + 2]!] as const);
  const spread = Math.max(
    ...[0, 1, 2].map((c) => {
      const vals = sample.map((s) => s[c]!);
      return Math.max(...vals) - Math.min(...vals);
    }),
  );
  if (spread > TOLERANCE) return sharp(data, { raw: info }).webp({ quality: 90 }).toBuffer();

  const [br, bg, bb] = sample[0]!;

  for (let i = 0; i < data.length; i += channels) {
    const d =
      Math.abs(data[i]! - br) + Math.abs(data[i + 1]! - bg) + Math.abs(data[i + 2]! - bb);
    if (d <= TOLERANCE) data[i + 3] = 0;
  }

  return sharp(data, { raw: info }).webp({ quality: 90 }).toBuffer();
}

let fetched = 0;
let skipped = 0;
let noSource = 0;
const failed: string[] = [];

for (const provider of providers) {
  const dest = path.join(outDir, `${provider.slug}.webp`);
  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  if (!provider.logo) {
    noSource++;
    continue;
  }

  const url = `${base}${provider.logo}?w=${WIDTH}&h=${HEIGHT}&fit=min&auto=format`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      failed.push(`${provider.slug} (HTTP ${response.status})`);
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, await knockOutBackdrop(buffer));
    fetched++;
    if (fetched % 25 === 0) console.log(`  ${fetched} fetched…`);
  } catch (error) {
    failed.push(`${provider.slug} (${(error as Error).message})`);
  }
}

console.log(
  `fetch-provider-logos: ${fetched} fetched, ${skipped} already present, ` +
    `${noSource} with no source asset, ${failed.length} failed`,
);
if (failed.length) {
  console.log(`  failed: ${failed.slice(0, 20).join(', ')}${failed.length > 20 ? ' …' : ''}`);
}
