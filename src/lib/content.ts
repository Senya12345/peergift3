import fs from 'node:fs';
import path from 'node:path';
import {
  casinoSchema,
  currencySchema,
  factorSchema,
  type Casino,
  type Currency,
  type Factor,
} from './schemas';

const CONTENT_ROOT = path.join(process.cwd(), 'src/content');

/**
 * Demo records let the site be built and reviewed before any real casino lands.
 * They are opt-in, so a production build can never ship invented data by accident.
 */
export const includeDemo = process.env.INCLUDE_DEMO === 'true';

/**
 * Whole-site indexing switch. An empty aggregator that gets crawled earns a thin-content
 * reputation that takes months to shed, so indexing stays off until there is a site
 * worth indexing.
 */
export const siteIndexable = process.env.SITE_INDEXABLE === 'true';

function readJsonDir(dir: string): { file: string; data: unknown }[] {
  const full = path.join(CONTENT_ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((file) => ({
      file: path.join(dir, file),
      data: JSON.parse(fs.readFileSync(path.join(full, file), 'utf8')) as unknown,
    }));
}

function parseAll<T>(
  dir: string,
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
): T[] {
  return readJsonDir(dir).map(({ file, data }) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      // Fail loudly at build time. Silently skipping a malformed record is how a
      // casino quietly disappears from the rankings without anyone noticing.
      throw new Error(
        `Invalid content in ${file}:\n${JSON.stringify(result.error, null, 2)}`,
      );
    }
    return result.data as T;
  });
}

let casinoCache: Casino[] | null = null;
let factorCache: Factor[] | null = null;
let currencyCache: Currency[] | null = null;

export function loadCasinos(): Casino[] {
  if (!casinoCache) {
    const all = parseAll<Casino>('casinos', casinoSchema);
    casinoCache = includeDemo ? all : all.filter((c) => !c.demo);
  }
  return casinoCache;
}

export function loadFactors(): Factor[] {
  if (!factorCache) {
    // Factors are listed ascending, as specified in the brief.
    factorCache = parseAll<Factor>('factors', factorSchema).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
  return factorCache;
}

export function loadCurrencies(): Currency[] {
  if (!currencyCache) {
    currencyCache = parseAll<Currency>('currencies', currencySchema).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }
  return currencyCache;
}

/** Path segments that a facet slug may never claim. */
export const RESERVED_SLUGS = new Set([
  'casinos',
  'articles',
  'go',
  'about',
  'contact',
  'methodology',
  'privacy',
  'terms',
  'responsible-gambling',
  'affiliate-disclosure',
  'authors',
  'search',
  'api',
  '404',
]);
