/**
 * Eagerly-imported logo assets under src/assets/logos/, keyed by casino slug (the
 * filename minus extension). Mixed formats on purpose — logos arrive from whatever
 * source the site owner could get a clean file from, not one uniform pipeline like the
 * CC0 coin icon set.
 */
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/logos/*.{png,webp,svg,jpg,jpeg}',
  { eager: true },
);

const bySlug = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  const slug = path.match(/([a-z0-9-]+)\.[a-z]+$/)?.[1];
  if (slug) bySlug.set(slug, mod.default);
}

export function casinoLogo(slug: string): ImageMetadata | null {
  return bySlug.get(slug) ?? null;
}
