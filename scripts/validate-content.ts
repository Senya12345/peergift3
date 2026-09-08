import { loadCasinos, loadCurrencies, loadFactors, RESERVED_SLUGS } from '../src/lib/content';
import { getFacets } from '../src/lib/facets';
import { daysSince, lastVerified } from '../src/lib/ratings';
import { MIN_RATING_SOURCES, STALE_AFTER_DAYS } from '../src/lib/schemas';

const errors: string[] = [];
const warnings: string[] = [];

const casinos = loadCasinos();
const factors = loadFactors();
const currencies = loadCurrencies();
const facets = getFacets();

const factorSlugs = new Set(factors.map((f) => f.slug));
const currencyCodes = new Set(currencies.map((c) => c.code));

for (const casino of casinos) {
  // A factor or coin with no content file produces a chip pointing at a 404.
  for (const factor of casino.factors) {
    if (!factorSlugs.has(factor)) {
      errors.push(`${casino.slug}: unknown factor "${factor}" — create src/content/factors/${factor}.json`);
    }
  }
  for (const code of casino.currencies) {
    if (!currencyCodes.has(code)) {
      errors.push(`${casino.slug}: unknown currency "${code}" — create a file in src/content/currencies/`);
    }
  }

  // Every published figure must be traceable, or it is just an assertion.
  for (const source of casino.ratings.sources) {
    if (source.scale === 5 && source.score > 5) {
      errors.push(`${casino.slug}: ${source.id} score ${source.score} exceeds its 5-point scale`);
    }
    if (source.scale === 10 && source.score > 10) {
      errors.push(`${casino.slug}: ${source.id} score ${source.score} exceeds its 10-point scale`);
    }
  }

  const ids = casino.ratings.sources.map((s) => s.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length) {
    errors.push(`${casino.slug}: duplicate rating source(s) ${[...new Set(duplicates)].join(', ')}`);
  }

  if (casino.ratings.sources.length < MIN_RATING_SOURCES) {
    warnings.push(
      `${casino.slug}: only ${casino.ratings.sources.length} source(s), shown as unrated`,
    );
  }

  // Freshness is the whole defence against a static rating going quietly stale.
  const verified = lastVerified(casino);
  if (verified) {
    const age = daysSince(verified);
    if (age > STALE_AFTER_DAYS) {
      warnings.push(`${casino.slug}: last verified ${age} days ago — due for a re-check`);
    }
  } else if (casino.ratings.sources.length > 0) {
    errors.push(`${casino.slug}: has sources but no verification date`);
  }
}

// Facet slugs sit at the site root, so a collision silently shadows a real route.
const seenSlugs = new Map<string, string>();
for (const facet of facets) {
  if (RESERVED_SLUGS.has(facet.slug)) {
    errors.push(`facet "${facet.slug}" collides with a reserved route`);
  }
  const previous = seenSlugs.get(facet.slug);
  if (previous) {
    errors.push(`facet slug "${facet.slug}" is claimed by both ${previous} and ${facet.key}`);
  }
  seenSlugs.set(facet.slug, facet.key);

  if (facet.slug.length > 60) {
    warnings.push(`facet "${facet.slug}" is long; keep URLs well under 100 characters`);
  }
}

// A facet nothing links to is a page Google finds by sitemap alone, if at all.
const linkedFacets = new Set<string>();
for (const casino of casinos) {
  for (const f of facets) {
    const matches = f.kind === 'factor'
      ? casino.factors.includes(f.key)
      : casino.currencies.includes(f.key);
    if (matches) linkedFacets.add(f.slug);
  }
}
for (const facet of facets) {
  if (!linkedFacets.has(facet.slug)) {
    warnings.push(`facet "/${facet.slug}/" is an orphan — no casino links to it`);
  }
}

const indexable = facets.filter((f) => f.indexable);
console.log(
  `validate-content: ${casinos.length} casinos, ${factors.length} factors, ` +
    `${currencies.length} currencies, ${facets.length} facets ` +
    `(${indexable.length} indexable)`,
);

for (const warning of warnings) console.warn(`  warn  ${warning}`);
for (const error of errors) console.error(`  ERROR ${error}`);

if (errors.length) {
  console.error(`\nvalidate-content failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`validate-content: OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
