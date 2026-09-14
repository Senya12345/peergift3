/**
 * Provider marks under src/assets/providers/, keyed by provider slug.
 *
 * The directory is populated by scripts/fetch-provider-logos.ts rather than by hand, and
 * is expected to be incomplete: the grid renders a name tile for any studio whose logo has
 * not been fetched, so a missing file degrades instead of breaking the page.
 */
const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/providers/*.{png,webp,svg,avif}',
  { eager: true },
);

const bySlug = new Map<string, ImageMetadata>();
for (const [path, mod] of Object.entries(modules)) {
  const slug = path.match(/([a-z0-9-]+)\.[a-z]+$/)?.[1];
  if (slug) bySlug.set(slug, mod.default);
}

export function providerLogo(slug: string): ImageMetadata | null {
  return bySlug.get(slug) ?? null;
}

export const providerLogoCount = bySlug.size;
