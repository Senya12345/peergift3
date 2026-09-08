import { loadCasinos, loadCurrencies, loadFactors } from './content';
import { byScoreDesc } from './ratings';
import { FACET_MIN_CASINOS, type Casino } from './schemas';

export interface Facet {
  kind: 'factor' | 'currency';
  /** Key used to match casinos: factor slug, or currency code. */
  key: string;
  /** URL segment, without slashes. */
  slug: string;
  /** Short label for chips and filter controls. */
  name: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  faq: { q: string; a: string }[];
  casinos: Casino[];
  /**
   * A facet enters the index only once it holds real choice. Below the threshold the
   * page is still built — the filter has to work — but it is noindexed and kept out of
   * the sitemap. It promotes itself as soon as enough casinos qualify, with no code
   * change and no migration.
   */
  indexable: boolean;
}

function build(
  kind: Facet['kind'],
  key: string,
  slug: string,
  name: string,
  meta: {
    h1: string;
    metaTitle: string;
    metaDescription: string;
    intro: string;
    faq: { q: string; a: string }[];
  },
  casinos: Casino[],
): Facet {
  // Fields are listed explicitly rather than spread: the source records carry their own
  // `slug`, and spreading them silently overwrote the facet's URL segment with it.
  return {
    kind,
    key,
    slug,
    name,
    h1: meta.h1,
    metaTitle: meta.metaTitle,
    metaDescription: meta.metaDescription,
    intro: meta.intro,
    faq: meta.faq,
    casinos: [...casinos].sort(byScoreDesc),
    indexable: casinos.length >= FACET_MIN_CASINOS,
  };
}

export function getFacets(): Facet[] {
  const casinos = loadCasinos();

  const factorFacets = loadFactors().map((f) =>
    build('factor', f.slug, f.facetSlug, f.name, f, casinos.filter((c) => c.factors.includes(f.slug))),
  );

  const currencyFacets = loadCurrencies().map((c) =>
    build(
      'currency',
      c.code,
      c.facetSlug,
      c.name,
      c,
      casinos.filter((casino) => casino.currencies.includes(c.code)),
    ),
  );

  return [...factorFacets, ...currencyFacets];
}

export function getFacetBySlug(slug: string): Facet | undefined {
  return getFacets().find((f) => f.slug === slug);
}

/** Facets a given casino belongs to — used for the chips and internal linking. */
export function facetsForCasino(casino: Casino): Facet[] {
  return getFacets().filter((f) =>
    f.kind === 'factor'
      ? casino.factors.includes(f.key)
      : casino.currencies.includes(f.key),
  );
}

/**
 * Related facets for the cross-linking block: those sharing the most casinos with the
 * given facet. Keeps every facet page reachable and avoids orphans without resorting to
 * a link dump.
 */
export function relatedFacets(facet: Facet, limit = 5): Facet[] {
  const own = new Set(facet.casinos.map((c) => c.slug));
  return getFacets()
    .filter((f) => f.slug !== facet.slug && f.casinos.length > 0)
    .map((f) => ({
      facet: f,
      overlap: f.casinos.filter((c) => own.has(c.slug)).length,
    }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.facet.name.localeCompare(b.facet.name))
    .slice(0, limit)
    .map((x) => x.facet);
}

/** Absolute paths of every facet page that belongs in the sitemap. */
export function indexableFacetPaths(): string[] {
  return getFacets()
    .filter((f) => f.indexable)
    .map((f) => `/${f.slug}/`);
}
