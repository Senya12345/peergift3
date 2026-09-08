import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { getFacets } from './src/lib/facets';
import { siteIndexable } from './src/lib/content';

const site = process.env.SITE_URL ?? 'https://casilla.example';

/**
 * Facets below the casino threshold are noindexed, and a noindexed URL in a sitemap is
 * a contradictory signal. Compute the exclusion list from the same source the pages use,
 * so the two can never disagree.
 */
const noindexPaths = new Set(
  getFacets()
    .filter((f) => !f.indexable)
    .map((f) => `/${f.slug}/`),
);

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
              return !pathname.startsWith('/go/') && !noindexPaths.has(pathname);
            },
          }),
        ]
      : []),
  ],
  vite: { plugins: [tailwindcss()] },
});
