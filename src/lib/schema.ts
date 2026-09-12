import { aggregateScore, lastVerified } from './ratings';
import { absolute, SITE } from './site';
import type { Casino } from './schemas';
import type { Facet } from './facets';

type Json = Record<string, unknown>;

const withContext = (node: Json): Json => ({ '@context': 'https://schema.org', ...node });

export const organizationId = absolute('/#organization');
const websiteId = absolute('/#website');

export function organization(): Json {
  return {
    '@type': 'Organization',
    '@id': organizationId,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    email: SITE.email,
  };
}

/**
 * A same-document stand-in for `{ '@id': organizationId }`. Each JSON-LD block on this
 * site is emitted as its own standalone `<script>` tag rather than one shared `@graph`
 * (see JsonLd.astro), so a bare `@id` reference to the Organization node defined on the
 * homepage resolves to nothing on every other page — Google's Rich Results parser
 * validates each script independently and flagged exactly this: author/publisher with
 * no `name` and no `@type`. Repeating `name` and `url` inline costs a few bytes and
 * keeps every page's structured data self-contained.
 */
function organizationRef(): Json {
  return { '@type': 'Organization', '@id': organizationId, name: SITE.name, url: SITE.url };
}

export function website(): Json {
  return withContext({
    '@type': 'WebSite',
    '@id': websiteId,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    publisher: organizationRef(),
    inLanguage: SITE.locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.url}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  });
}

export function breadcrumbs(trail: { name: string; path: string }[]): Json {
  return withContext({
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absolute(item.path),
    })),
  });
}

export function casinoList(casinos: Casino[], pathFor = (c: Casino) => `/casinos/${c.slug}/`): Json {
  return withContext({
    '@type': 'ItemList',
    numberOfItems: casinos.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: casinos.map((casino, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absolute(pathFor(casino)),
      name: casino.name,
    })),
  });
}

/**
 * Our editorial verdict on a third party, expressed as a Review whose author is us.
 *
 * Deliberately NOT AggregateRating: that type describes an aggregate of reviews the
 * publisher itself collected, and ours is a mean of figures other platforms published.
 * Claiming it would misstate what the number is. The per-source breakdown stays visible
 * on the page instead, where readers and AI search can both use it.
 */
export function casinoReview(casino: Casino): Json | null {
  const score = aggregateScore(casino);
  if (score === null) return null;

  return withContext({
    '@type': 'Review',
    url: absolute(`/casinos/${casino.slug}/`),
    itemReviewed: {
      '@type': 'Organization',
      name: casino.name,
      url: casino.url,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: score,
      bestRating: 10,
      worstRating: 0,
    },
    author: organizationRef(),
    publisher: organizationRef(),
    dateModified: lastVerified(casino),
  });
}

export function collectionPage(facet: Facet): Json {
  return withContext({
    '@type': 'CollectionPage',
    '@id': absolute(`/${facet.slug}/`),
    url: absolute(`/${facet.slug}/`),
    name: facet.h1,
    description: facet.metaDescription,
    isPartOf: { '@type': 'WebSite', '@id': websiteId, name: SITE.name, url: SITE.url },
    publisher: organizationRef(),
  });
}

/**
 * FAQ rich results have been restricted to government and health sites since 2023, so
 * this earns no stars in the SERP. It stays because AI Overviews, ChatGPT search and
 * Perplexity do read it, and answering the question in structured form is how a page
 * gets cited rather than merely crawled.
 */
export function faqPage(faq: { q: string; a: string }[]): Json | null {
  if (faq.length === 0) return null;
  return withContext({
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  });
}
