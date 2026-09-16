import type { APIRoute } from 'astro';
import { CASINO_SLOTS_PAGE_INITIAL_COUNT, getCasinoSlots } from '../../../lib/casino-slots';
import { loadCasinos } from '../../../lib/content';
import { getProviders } from '../../../lib/providers';
import { slotIconUrl } from '../../../lib/slot-icons';

/** The tail of one casino's slot list that slots.astro doesn't put in its own HTML —
 * same reasoning as slots-index.json.ts, one casino at a time. */
export function getStaticPaths() {
  return loadCasinos()
    .filter((casino) => getCasinoSlots(casino.slug).length > 0)
    .map((casino) => ({ params: { slug: casino.slug } }));
}

export const GET: APIRoute = ({ params }) => {
  const providerName = new Map(getProviders().map((p) => [p.slug, p.name]));
  const rest = getCasinoSlots(params.slug!)
    .slice(CASINO_SLOTS_PAGE_INITIAL_COUNT)
    .map(({ slot }) => ({
      slug: slot.slug,
      name: slot.name,
      provider: slot.provider, // slug, used for the provider-filter dropdown
      providerName: providerName.get(slot.provider) ?? slot.provider,
      icon: slotIconUrl(slot.slug),
    }));
  return new Response(JSON.stringify(rest), {
    headers: { 'Content-Type': 'application/json' },
  });
};
