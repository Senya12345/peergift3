import { getProviders } from './providers';
import { getSlots, type SlotView } from './slots';

export interface CasinoSlotEntry {
  slot: SlotView;
  /** This casino's own catalogue position for the game — the ordering a casino page's
   * slot list uses, not the site-wide /slots order. */
  position: number;
}

export interface CasinoProviderEntry {
  slug: string;
  name: string;
  slotCount: number;
}

/**
 * Where /casinos/{slug}/slots.astro's own HTML stops and slots.json.ts's payload starts
 * — same boundary idea as SLOTS_PAGE_INITIAL_COUNT in slots.ts. 1win alone carries close
 * to 12,000 games, so this matters per-casino too, not only on the site-wide /slots page.
 */
export const CASINO_SLOTS_PAGE_INITIAL_COUNT = 200;

const slotCache = new Map<string, CasinoSlotEntry[]>();
const providerCache = new Map<string, CasinoProviderEntry[]>();

/** Every catalogued slot this casino carries, in that casino's own listing order. */
export function getCasinoSlots(casinoSlug: string): CasinoSlotEntry[] {
  const cached = slotCache.get(casinoSlug);
  if (cached) return cached;

  const entries: CasinoSlotEntry[] = [];
  for (const slot of getSlots()) {
    const row = slot.availability.find((a) => a.casino === casinoSlug);
    if (row) entries.push({ slot, position: row.position });
  }
  entries.sort((a, b) => a.position - b.position);
  slotCache.set(casinoSlug, entries);
  return entries;
}

/**
 * Providers this casino actually carries, by its own slot catalogue — not the hand-typed
 * `Casino.providers` list, which is editorial confirmation of a studio's presence rather
 * than a count of its games. Ordered by how early the studio's first (most prominent)
 * game sits in this casino's own listing, which is the closest honest reading of
 * "most popular first" without a real popularity metric.
 */
export function getCasinoProviders(casinoSlug: string): CasinoProviderEntry[] {
  const cached = providerCache.get(casinoSlug);
  if (cached) return cached;

  const providerName = new Map(getProviders().map((p) => [p.slug, p.name]));
  const byProvider = new Map<string, { count: number; minPosition: number }>();
  for (const { slot, position } of getCasinoSlots(casinoSlug)) {
    const existing = byProvider.get(slot.provider);
    if (existing) {
      existing.count++;
      if (position < existing.minPosition) existing.minPosition = position;
    } else {
      byProvider.set(slot.provider, { count: 1, minPosition: position });
    }
  }

  const entries = [...byProvider.entries()]
    .map(([slug, { count, minPosition }]) => ({
      slug,
      name: providerName.get(slug) ?? slug,
      slotCount: count,
      minPosition,
    }))
    .sort((a, b) => a.minPosition - b.minPosition)
    .map(({ slug, name, slotCount }) => ({ slug, name, slotCount }));

  providerCache.set(casinoSlug, entries);
  return entries;
}
