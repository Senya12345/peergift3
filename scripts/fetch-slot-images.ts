import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Downloads each slot's chosen box-art icon once and writes it into public/slot-icons/,
 * matching the pattern scripts/fetch-provider-logos.ts already uses for the network side
 * of things, but simpler on the image side:
 *
 * 1. No backdrop to knock out. Slot box art ships as finished artwork already meant to sit
 *    on a lobby tile, unlike the studio marks that arrive on someone else's flat plate.
 * 2. No resizing and effectively no recompression. These CDNs already serve a sensibly
 *    sized card (Stake's own URLs even request an exact size in the query string), so
 *    resizing down and re-encoding at a mid quality — what this script did at first —
 *    was compressing twice for no reason, and it showed on anything colourful and
 *    detailed. A source that's already WebP is written through byte-for-byte; anything
 *    else is re-encoded at a visually-lossless quality with its original dimensions kept.
 * 3. Lands in public/slot-icons/, not src/assets/slots/ — see src/lib/slot-icons.ts for
 *    why (a stable URL the client-side "load more" script can also build, not a hashed
 *    astro:assets path that only exists inside the build).
 *
 * Run it wherever the network reaches these CDNs — the build sandbox cannot, the VPS can:
 *
 *   npx tsx scripts/fetch-slot-images.ts
 *
 * ~24,000 candidate URLs across eight different CDNs: a per-request timeout and modest
 * concurrency keep one dead host from hanging the whole run, and already-downloaded icons
 * are skipped, so interrupting and re-running only fetches what's missing.
 */

const root = process.cwd();
const outDir = path.join(root, 'public/slot-icons');
const slotsFile = path.join(root, 'src/content/slots.json');

const TIMEOUT_MS = 15_000;
const CONCURRENCY = 8;

interface Entry {
  slug: string;
  icon: string | null;
}

const slots = JSON.parse(fs.readFileSync(slotsFile, 'utf8')) as Entry[];
fs.mkdirSync(outDir, { recursive: true });

let fetched = 0;
let skipped = 0;
let noSource = 0;
let timedOut = 0;
const failed: string[] = [];
let processed = 0;

async function fetchOne(slot: Entry): Promise<void> {
  const dest = path.join(outDir, `${slot.slug}.webp`);
  if (fs.existsSync(dest)) {
    skipped++;
    return;
  }
  if (!slot.icon) {
    noSource++;
    return;
  }

  try {
    const response = await fetch(slot.icon, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) {
      failed.push(`${slot.slug} (HTTP ${response.status})`);
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(buffer).metadata();
    const out =
      metadata.format === 'webp'
        ? buffer // already the right format, at the size the source chose — write it as is
        : await sharp(buffer).webp({ quality: 95, effort: 4 }).toBuffer();
    fs.writeFileSync(dest, out);
    fetched++;
  } catch (error) {
    const err = error as Error;
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      timedOut++;
      failed.push(`${slot.slug} (timed out after ${TIMEOUT_MS / 1000}s)`);
    } else {
      failed.push(`${slot.slug} (${err.message})`);
    }
  }
}

async function worker(queue: Entry[]): Promise<void> {
  let slot: Entry | undefined;
  while ((slot = queue.pop())) {
    await fetchOne(slot);
    processed++;
    if (processed % 250 === 0) {
      console.log(
        `  ${processed}/${slots.length} processed — ${fetched} fetched, ${skipped} present, ${failed.length} failed…`,
      );
    }
  }
}

const queue = [...slots].reverse(); // pop() takes from the end, so reverse keeps original order
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));

console.log(
  `fetch-slot-images: ${fetched} fetched, ${skipped} already present, ` +
    `${noSource} with no source icon, ${failed.length} failed (${timedOut} of those timed out)`,
);
if (failed.length) {
  console.log(`  failed: ${failed.slice(0, 20).join(', ')}${failed.length > 20 ? ' …' : ''}`);
}
