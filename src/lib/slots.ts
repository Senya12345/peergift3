import { loadSlots } from './content';
import { SLOT_MIN_CASINOS, type Slot } from './schemas';

export interface SlotView extends Slot {
  /** See SLOT_MIN_CASINOS — fewer than that many casinos and the page stays noindexed. */
  indexable: boolean;
  /**
   * Where this game sits in the site's own default ordering, lower first.
   *
   * Stake's own catalogue position is the reference when the game is there, because it is
   * at least a real ordering made by someone who sells these games — same reasoning
   * getProviders() already uses for stakeRank. Catalogue sizes differ wildly across
   * casinos (Stake carries roughly 9,000 titles, Winna a few thousand), so a raw index
   * would put a mid-table Winna game ahead of a genuinely popular Stake one; the fix is a
   * percentile (position / catalogue size) rather than the raw position. A game Stake
   * doesn't carry falls back to the average percentile across whichever casinos do have
   * it, which is the closest honest reading of "equate it to Stake's positioning" when
   * there is no Stake position to equate it to.
   */
  order: number;
}

/**
 * Where /slots/index.astro's own HTML stops and slots-index.json.ts's payload starts.
 * Kept here, not duplicated in each file, because the two only work together if they
 * agree on the boundary.
 */
export const SLOTS_PAGE_INITIAL_COUNT = 200;

let cache: SlotView[] | null = null;

function percentile(slot: Slot): number {
  const stakeRow = slot.availability.find((row) => row.casino === 'stake');
  if (stakeRow) return stakeRow.position / stakeRow.total;
  const ratios = slot.availability.map((row) => row.position / row.total);
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

/** Every slot, in the site's default display order. */
export function getSlots(): SlotView[] {
  if (cache) return cache;
  cache = loadSlots()
    .map((slot) => ({
      ...slot,
      indexable: slot.availability.length >= SLOT_MIN_CASINOS,
      order: percentile(slot),
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return cache;
}

export function getSlotBySlug(slug: string): SlotView | undefined {
  return getSlots().find((s) => s.slug === slug);
}

/** Absolute paths of every slot page that belongs in the sitemap. */
export function indexableSlotPaths(): string[] {
  return getSlots()
    .filter((s) => s.indexable)
    .map((s) => `/slots/${s.slug}/`);
}
