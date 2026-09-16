import type { APIRoute } from 'astro';
import { getProviders } from '../lib/providers';
import { getSlots, SLOTS_PAGE_INITIAL_COUNT } from '../lib/slots';

/**
 * The tail of the slot catalogue that /slots/index.astro does not put in its own HTML.
 *
 * At 24,000+ slots, one HTML page listing all of them runs into the megabytes — a real
 * cost to LCP and to how much of the page Google actually bothers reading. The fix is the
 * same one any large catalogue uses: put the first page of tiles in the HTML (crawlable,
 * fast first paint) and hand the rest to the client as data, fetched once and searched or
 * scrolled through in JS.
 */
export const GET: APIRoute = () => {
  const providerName = new Map(getProviders().map((p) => [p.slug, p.name]));
  const rest = getSlots()
    .slice(SLOTS_PAGE_INITIAL_COUNT)
    .map((slot) => ({
      slug: slot.slug,
      name: slot.name,
      provider: providerName.get(slot.provider) ?? slot.provider,
    }));
  return new Response(JSON.stringify(rest), {
    headers: { 'Content-Type': 'application/json' },
  });
};
