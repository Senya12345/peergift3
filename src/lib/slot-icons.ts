import fs from 'node:fs';
import path from 'node:path';

/**
 * Slot box art under public/slot-icons/, keyed by slot slug.
 *
 * Lives in public/ rather than src/assets/ — unlike provider logos and casino logos,
 * these need a stable, predictable URL (`/slot-icons/{slug}.webp`) because the same tile
 * markup is built twice: once server-side for the slots that ship in the page's initial
 * HTML, and once in plain client JS for the ones added from slots-index.json.ts on
 * "load more" — astro:assets' hashed output filenames only exist inside the Astro build,
 * not something a browser script can compute.
 *
 * Populated by scripts/fetch-slot-images.ts, which has to run somewhere the network
 * reaches the source CDNs (the build sandbox can't); the directory starts empty and fills
 * in over time. A slot with no local file yet renders with no image, never a hotlink to
 * the source — same rule as provider logos.
 */
const dir = path.join(process.cwd(), 'public/slot-icons');
const bySlug = new Set<string>(
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, ''))
    : [],
);

export function slotIconUrl(slug: string): string | null {
  return bySlug.has(slug) ? `/slot-icons/${slug}.webp` : null;
}

export const slotIconCount = bySlug.size;
