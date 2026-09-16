import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Downloads each slot's chosen box-art icon once and writes it into src/assets/slots/ as
 * WebP, matching the pattern scripts/fetch-provider-logos.ts already uses.
 *
 * Two differences from the provider version:
 *
 * 1. No backdrop to knock out. Slot box art ships as finished artwork already meant to sit
 *    on a lobby tile, unlike the studio marks that arrive on someone else's flat plate —
 *    this script resizes and re-encodes, nothing more.
 * 2. `Slot.icon` in slots.json is never rewritten. It stays the source URL for
 *    provenance and for re-fetching after a cache bust; src/lib/slot-icons.ts resolves the
 *    local file by slug at render time the same way provider-logos.ts does, and a slot
 *    with no local file yet just renders with no image — never a hotlink to the source.
 *
 * Run it wherever the network reaches these CDNs — the build sandbox cannot, the VPS can:
 *
 *   npx tsx scripts/fetch-slot-images.ts
 *
 * Several thousand files; expect this to take a while the first time. Already-downloaded
 * icons are skipped, so re-running after scripts/import-slots.ts picks up new casinos only
 * fetches what's new. Commit the result — the site never touches these CDNs at runtime.
 */

const root = process.cwd();
const outDir = path.join(root, 'src/assets/slots');
const slotsFile = path.join(root, 'src/content/slots.json');

/** Matches the aspect ratio these CDNs already crop to (roughly 3:4 portrait cards). */
const WIDTH = 180;
const HEIGHT = 236;

interface Entry {
  slug: string;
  icon: string | null;
}

const slots = JSON.parse(fs.readFileSync(slotsFile, 'utf8')) as Entry[];
fs.mkdirSync(outDir, { recursive: true });

let fetched = 0;
let skipped = 0;
let noSource = 0;
const failed: string[] = [];

for (const slot of slots) {
  const dest = path.join(outDir, `${slot.slug}.webp`);
  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }
  if (!slot.icon) {
    noSource++;
    continue;
  }

  try {
    const response = await fetch(slot.icon);
    if (!response.ok) {
      failed.push(`${slot.slug} (HTTP ${response.status})`);
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const webp = await sharp(buffer)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    fs.writeFileSync(dest, webp);
    fetched++;
    if (fetched % 200 === 0) console.log(`  ${fetched} fetched…`);
  } catch (error) {
    failed.push(`${slot.slug} (${(error as Error).message})`);
  }
}

console.log(
  `fetch-slot-images: ${fetched} fetched, ${skipped} already present, ` +
    `${noSource} with no source icon, ${failed.length} failed`,
);
if (failed.length) {
  console.log(`  failed: ${failed.slice(0, 20).join(', ')}${failed.length > 20 ? ' …' : ''}`);
}
