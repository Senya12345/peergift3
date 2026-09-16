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
 * ~24,000 candidate URLs across eight different CDNs, so two things that don't matter at
 * provider-logo scale (a few hundred fetches from one host) matter a lot here: a single
 * request with no timeout can hang the whole run indefinitely on one dead host, and doing
 * it one at a time is slow enough to look stalled even when it isn't. Both are handled
 * below — a per-request timeout and modest concurrency across hosts. Already-downloaded
 * icons are skipped, so interrupting and re-running (or resuming after a fix) only
 * refetches what's missing; nothing already written is redone.
 */

const root = process.cwd();
const outDir = path.join(root, 'src/assets/slots');
const slotsFile = path.join(root, 'src/content/slots.json');

/** Matches the aspect ratio these CDNs already crop to (roughly 3:4 portrait cards). */
const WIDTH = 180;
const HEIGHT = 236;

/** A stuck connection to one dead host would otherwise hang the whole run forever. */
const TIMEOUT_MS = 15_000;

/** Different slots mostly hit different CDN hosts, so this is safe without a per-host cap. */
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
    const webp = await sharp(buffer)
      .resize(WIDTH, HEIGHT, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    fs.writeFileSync(dest, webp);
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
