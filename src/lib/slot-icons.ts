/**
 * Slot box art under src/assets/slots/, keyed by slot slug — same pattern as
 * src/lib/provider-logos.ts.
 *
 * Populated by scripts/fetch-slot-images.ts, which has to run somewhere the network
 * reaches the source CDNs (the build sandbox can't); the directory starts empty and fills
 * in over time. Nothing here ever falls back to hotlinking the source URL still recorded
 * in Slot.icon — the whole reason that download step exists is to stop billing someone
 * else's CDN for this site's traffic, so a slot with no local file yet renders with no
 * image at all rather than one pointed at the original source.
 */
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/slots/*.{png,webp,jpg,jpeg,avif}',
  { eager: true },
);

const bySlug = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  const slug = path.match(/([a-z0-9-]+)\.[a-z]+$/)?.[1];
  if (slug) bySlug.set(slug, mod.default);
}

export function slotIcon(slug: string): ImageMetadata | null {
  return bySlug.get(slug) ?? null;
}

export const slotIconCount = bySlug.size;
