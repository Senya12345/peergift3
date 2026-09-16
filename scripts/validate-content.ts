import {
  loadCasinos,
  loadCurrencies,
  loadFactors,
  loadProviders,
  loadSlots,
  RESERVED_SLUGS,
} from '../src/lib/content';
import { getFacets } from '../src/lib/facets';
import { getProviders } from '../src/lib/providers';
import { COUNTRY_CODES } from '../src/lib/countries';
import { daysSince, lastVerified } from '../src/lib/ratings';
import { MIN_RATING_SOURCES, SLOT_MIN_CASINOS, STALE_AFTER_DAYS } from '../src/lib/schemas';

const errors: string[] = [];
const warnings: string[] = [];

const casinos = loadCasinos();
const factors = loadFactors();
const currencies = loadCurrencies();
const facets = getFacets();
const providers = loadProviders();
const slots = loadSlots();
const providerViews = getProviders();

const casinoSlugs = new Set(casinos.map((c) => c.slug));
const factorSlugs = new Set(factors.map((f) => f.slug));
const currencyCodes = new Set(currencies.map((c) => c.code));
const networksByCode = new Map(currencies.map((c) => [c.code, new Set(c.networks.map((n) => n.code))]));

for (const casino of casinos) {
  // A factor or coin with no content file produces a chip pointing at a 404.
  for (const factor of casino.factors) {
    if (!factorSlugs.has(factor)) {
      errors.push(`${casino.slug}: unknown factor "${factor}" — create src/content/factors/${factor}.json`);
    }
  }
  for (const support of casino.currencies) {
    const code = support.code;
    if (!currencyCodes.has(code)) {
      errors.push(`${casino.slug}: unknown currency "${code}" — create a file in src/content/currencies/`);
      continue;
    }
    // A network the coin's own registry doesn't list is either a typo or a network
    // that needs adding to the currency file first — either way it would render a
    // filter option that matches nothing.
    const validNetworks = networksByCode.get(code)!;
    for (const network of support.networks) {
      if (!validNetworks.has(network)) {
        errors.push(
          `${casino.slug}: "${code}" network "${network}" is not listed in src/content/currencies/ for that coin`,
        );
      }
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
      : casino.currencies.some((support) => support.code === f.key);
    if (matches) linkedFacets.add(f.slug);
  }
}
for (const facet of facets) {
  if (!linkedFacets.has(facet.slug)) {
    warnings.push(`facet "/${facet.slug}/" is an orphan — no casino links to it`);
  }
}

// --- restricted-country lists ---

let withRestrictions = 0;
for (const casino of casinos) {
  if (!casino.restrictions) continue;
  withRestrictions++;

  const seen = new Set<string>();
  for (const code of casino.restrictions.countries) {
    // A code that is not real never matches whatever a reader picks, so the checker would
    // quietly under-report which countries the operator refuses.
    if (!COUNTRY_CODES.has(code)) {
      errors.push(`${casino.slug}: "${code}" is not an ISO 3166-1 alpha-2 country code`);
    }
    if (seen.has(code)) {
      warnings.push(`${casino.slug}: country "${code}" listed twice in restrictions`);
    }
    seen.add(code);
  }
}
if (withRestrictions < casinos.length) {
  warnings.push(
    `${casinos.length - withRestrictions} of ${casinos.length} casinos have no restricted-country list — their country check says so rather than guessing`,
  );
}

// --- providers and slots ---

const providerSlugs = new Set<string>();
for (const provider of providers) {
  if (providerSlugs.has(provider.slug)) {
    errors.push(`duplicate provider slug "${provider.slug}"`);
  }
  providerSlugs.add(provider.slug);
}

const slotSlugs = new Set<string>();
for (const slot of slots) {
  if (slotSlugs.has(slot.slug)) errors.push(`duplicate slot slug "${slot.slug}"`);
  slotSlugs.add(slot.slug);

  // A slot pointing at a provider that isn't in the registry renders a link to a 404 and
  // silently drops the game off that provider's page.
  if (!providerSlugs.has(slot.provider)) {
    errors.push(`slot "${slot.slug}": unknown provider "${slot.provider}"`);
  }
  for (const row of slot.rtpByCasino) {
    if (!casinoSlugs.has(row.casino)) {
      errors.push(`slot "${slot.slug}": RTP recorded against unknown casino "${row.casino}"`);
    }
  }
  const seenAvailability = new Set<string>();
  for (const row of slot.availability) {
    if (!casinoSlugs.has(row.casino)) {
      errors.push(`slot "${slot.slug}": listed at unknown casino "${row.casino}"`);
    }
    if (seenAvailability.has(row.casino)) {
      errors.push(`slot "${slot.slug}": casino "${row.casino}" listed twice in availability`);
    }
    seenAvailability.add(row.casino);
    if (row.position >= row.total) {
      errors.push(
        `slot "${slot.slug}": position ${row.position} at "${row.casino}" is not less than that casino's catalogue size ${row.total}`,
      );
    }
  }
}

// The whole point of the provider work is the games hanging off it. Until a provider has
// one, its page is noindexed — worth reporting as a running count rather than a surprise.
const indexableProviders = providerViews.filter((p) => p.indexable).length;
if (indexableProviders === 0 && providers.length > 0) {
  warnings.push(
    `all ${providers.length} provider pages are noindexed — none has a slot listed yet`,
  );
}

const reconstructed = providers.filter((p) => p.nameReconstructed).length;
if (reconstructed > 0) {
  warnings.push(
    `${reconstructed} provider name(s) best-effort reconstructed (from a casino's i18n keys or an unresolved slot import token) — spelling unconfirmed`,
  );
}

// Same thin-content gate as providers, one step further down: a slot found at one or two
// casinos is a page with nothing to compare, so it stays noindexed until a third casino
// picks it up. See SLOT_MIN_CASINOS in src/lib/schemas.ts for the reasoning.
const indexableSlots = slots.filter((s) => s.availability.length >= SLOT_MIN_CASINOS).length;
if (slots.length > 0) {
  warnings.push(
    `${indexableSlots} of ${slots.length} slots are indexable (at ${SLOT_MIN_CASINOS}+ casinos); the rest are noindexed until a ${SLOT_MIN_CASINOS === 3 ? 'third' : `${SLOT_MIN_CASINOS}th`} casino lists them`,
  );
}

const indexable = facets.filter((f) => f.indexable);
console.log(
  `validate-content: ${casinos.length} casinos, ${factors.length} factors, ` +
    `${currencies.length} currencies, ${facets.length} facets ` +
    `(${indexable.length} indexable), ${providers.length} providers ` +
    `(${indexableProviders} indexable), ${slots.length} slots (${indexableSlots} indexable)`,
);

for (const warning of warnings) console.warn(`  warn  ${warning}`);
for (const error of errors) console.error(`  ERROR ${error}`);

if (errors.length) {
  console.error(`\nvalidate-content failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`validate-content: OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
