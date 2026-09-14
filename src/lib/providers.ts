import { loadProviders, loadSlots } from './content';
import { PROVIDER_MIN_SLOTS, type Provider, type Slot } from './schemas';

export interface ProviderView extends Provider {
  slots: Slot[];
  /** See PROVIDER_MIN_SLOTS — a studio with no games listed is not an indexable page. */
  indexable: boolean;
}

let cache: ProviderView[] | null = null;

/**
 * Providers in Stake's own ordering, each with the slots recorded against it.
 *
 * The order is Stake's commercial curation, taken as a stand-in for prominence because it
 * is at least a real ordering made by someone who sells these games. It is not a measured
 * popularity figure and is never presented to readers as a ranking — nothing on the page
 * is numbered.
 */
export function getProviders(): ProviderView[] {
  if (cache) return cache;

  const slots = loadSlots();
  const byProvider = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = byProvider.get(slot.provider);
    if (list) list.push(slot);
    else byProvider.set(slot.provider, [slot]);
  }

  cache = loadProviders().map((provider) => {
    const own = (byProvider.get(provider.slug) ?? []).sort((a, b) => {
      // Newest first, matching the default the slot lists use elsewhere; undated slots
      // sort last rather than pretending to be the freshest thing on the page.
      if (a.releasedAt && b.releasedAt) return b.releasedAt.localeCompare(a.releasedAt);
      if (a.releasedAt) return -1;
      if (b.releasedAt) return 1;
      return a.name.localeCompare(b.name);
    });
    return { ...provider, slots: own, indexable: own.length >= PROVIDER_MIN_SLOTS };
  });

  return cache;
}

export function getProviderBySlug(slug: string): ProviderView | undefined {
  return getProviders().find((p) => p.slug === slug);
}

/** Absolute paths of every provider page that belongs in the sitemap. */
export function indexableProviderPaths(): string[] {
  return getProviders()
    .filter((p) => p.indexable)
    .map((p) => `/providers/${p.slug}/`);
}
