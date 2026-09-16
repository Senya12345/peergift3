import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { getFacets } from './src/lib/facets';
import { getProviders } from './src/lib/providers';
import { getSlots } from './src/lib/slots';
import { loadSlots, siteIndexable } from './src/lib/content';

const site = process.env.SITE_URL ?? 'https://gambleatlas.example';

/**
 * Pages that are built but noindexed, and a noindexed URL in a sitemap is a contradictory
 * signal. Computed from the same sources the pages use, so the two can never disagree:
 * facets below the casino threshold, provider pages with no games listed yet, and the
 * slots index while there are none.
 */
const noindexPaths = new Set([
  ...getFacets()
    .filter((f) => !f.indexable)
    .map((f) => `/${f.slug}/`),
  ...getProviders()
    .filter((p) => !p.indexable)
    .map((p) => `/providers/${p.slug}/`),
  ...(loadSlots().length === 0 ? ['/slots/'] : []),
  // A slot at fewer than SLOT_MIN_CASINOS casinos is a page with nothing to compare —
  // built and linked so the grid and casino slot lists resolve, kept out of the index
  // until a third casino picks it up. See SLOT_MIN_CASINOS in src/lib/schemas.ts.
  ...getSlots()
    .filter((s) => !s.indexable)
    .map((s) => `/slots/${s.slug}/`),
]);

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    mdx(),
    // No sitemap at all while the whole site is noindexed.
    ...(siteIndexable
      ? [
          sitemap({
            filter: (page) => {
              const { pathname } = new URL(page);
              // .json endpoints (slots-index.json, casinos/{slug}/slots.json) back the
              // client-side "load more" pagination — data, not a page anyone should land
              // on from search.
              return (
                !pathname.startsWith('/go/') &&
                !pathname.endsWith('.json') &&
                !noindexPaths.has(pathname)
              );
            },
          }),
        ]
      : []),
  ],
  vite: { plugins: [tailwindcss()] },
});
