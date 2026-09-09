import { z } from 'zod';

/**
 * A casino with fewer than this many rating sources gets no aggregate score.
 * Averaging one or two numbers is not an aggregate, it is a quote.
 */
export const MIN_RATING_SOURCES = 3;

/** A facet page stays out of the index until it holds at least this many casinos. */
export const FACET_MIN_CASINOS = 5;

/** Build warns when a casino's facts were last checked longer ago than this. */
export const STALE_AFTER_DAYS = 45;

export const RATING_SOURCE_IDS = [
  'askgamblers',
  'casinoguru',
  'trustpilot',
  'casinomeister',
  'lcb',
  'bitcoincom',
] as const;

export type RatingSourceId = (typeof RATING_SOURCE_IDS)[number];

/**
 * Display metadata per source. `label` names the metric honestly — Casino Guru
 * publishes a Safety Index, which is not the same animal as a star rating, and
 * presenting them under one heading would be a quiet lie.
 */
export const RATING_SOURCES: Record<
  RatingSourceId,
  { name: string; label: string; abbr: string }
> = {
  // Specifically the player-submitted score, not AskGamblers' own proprietary
  // "CasinoRank" algorithm — the two can diverge sharply (a real case: 2.8 vs 9.6 on
  // the same casino) and only one of them is a plain, checkable number rather than an
  // undisclosed blend of business factors.
  askgamblers: { name: 'AskGamblers', label: 'AskGamblers player rating', abbr: 'AG' },
  casinoguru: { name: 'Casino Guru', label: 'Casino Guru Safety Index', abbr: 'CG' },
  trustpilot: { name: 'Trustpilot', label: 'Trustpilot score', abbr: 'TP' },
  casinomeister: { name: 'Casinomeister', label: 'Casinomeister rating', abbr: 'CM' },
  lcb: { name: 'LCB', label: 'LCB player rating', abbr: 'LCB' },
  bitcoincom: { name: 'Bitcoin.com Games', label: 'Bitcoin.com rating', abbr: 'BTC' },
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO date, e.g. 2026-09-08');

/**
 * A minimum expressed in the coin's own units, never converted to USD. A crypto price
 * moves daily; a USD figure we computed ourselves would be stale before the page is
 * read. The native amount ("0.001 BTC") doesn't decay the same way.
 */
const nativeAmount = z.object({
  amount: z.number().positive(),
  /** Where this figure was read, so it stays checkable like everything else. */
  source: z.string().optional(),
});

/** One casino's support for one coin. */
export const currencySupportSchema = z.object({
  /** Matches a currency file's `code`. */
  code: z.string().regex(/^[A-Z0-9]{2,10}$/),
  /** Network codes this casino actually offers for the coin, e.g. ["ERC20","BEP20"]. */
  networks: z.array(z.string()).default([]),
  minDeposit: nativeAmount.nullable().default(null),
  minWithdrawal: nativeAmount.nullable().default(null),
});

export const ratingSourceSchema = z.object({
  id: z.enum(RATING_SOURCE_IDS),
  score: z.number().positive(),
  /** Native scale of the source. Normalised to 10 at build time. */
  scale: z.union([z.literal(5), z.literal(10)]),
  /** Deep link to this casino's page on the source, so the figure is checkable. */
  url: z.url(),
  verifiedAt: isoDate,
});

export const casinoSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase, hyphenated'),
  name: z.string().min(1),
  /** Path under src/assets/logos/, or null while we still lack a logo. */
  logo: z.string().nullable().default(null),
  /** The casino's own site. Used as the /go/ target until an affiliate URL exists. */
  url: z.url(),
  affiliateUrl: z.url().nullable().default(null),

  signupBonus: z
    .object({
      headline: z.string().min(1),
      detail: z.string().optional(),
      verifiedAt: isoDate,
    })
    .nullable()
    .default(null),

  ratings: z.object({
    sources: z.array(ratingSourceSchema),
  }),

  /** Factor slugs. Every one must resolve to a factor file. */
  factors: z.array(z.string()).default([]),
  /**
   * Per-coin support. Richer than a bare code list because minimums and available
   * chains are a property of THIS casino, not of the coin itself — two casinos
   * supporting USDT can offer different networks and different withdrawal floors.
   */
  currencies: z.array(currencySupportSchema).default([]),

  editorial: z.object({
    summary: z.string().min(1),
    pros: z.array(z.string()).min(3),
    cons: z.array(z.string()).min(2),
  }),

  license: z.string().nullable().default(null),
  founded: z.number().int().optional(),

  /**
   * A synthesis of what public reviews say about withdrawals, deposits and recurring
   * complaints, clearly labelled as AI-generated rather than folded into the editorial
   * voice above. Transparency about authorship is the point — an unlabelled synthesis
   * would blur into a claim of first-hand testing we did not do.
   */
  aiSummary: z
    .object({
      withdrawals: z.string().min(1),
      deposits: z.string().min(1),
      commonProblems: z.string().min(1),
      generatedAt: isoDate,
    })
    .nullable()
    .default(null),

  /** Demo records exist so the site can be built before real data lands. */
  demo: z.boolean().default(false),
});

export const factorSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /** Label in the filter list and on chips, e.g. "No KYC". */
  name: z.string().min(1),
  /**
   * URL segment for this factor's facet page. Set explicitly rather than derived,
   * because the phrasing that ranks is rarely the phrasing that reads well as a chip.
   */
  facetSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  h1: z.string().min(1),
  metaTitle: z.string().min(1).max(70),
  metaDescription: z.string().min(1).max(165),
  /** 300+ words of prose unique to this facet. Enforced by slop-lint. */
  intro: z.string().min(1),
  faq: z
    .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
    .default([]),
});

/**
 * Currencies carry the same editorial payload as factors, because /bitcoin-casinos/
 * is a money page in its own right and a list with no prose is a thin page whatever
 * generated it.
 */
export const networkSchema = z.object({
  /** Short code used in casino records and filter state, e.g. "ERC20". */
  code: z.string().min(1),
  /** Full name shown in the network picker, e.g. "Ethereum (ERC20)". */
  name: z.string().min(1),
});

export const currencySchema = z.object({
  /** Ticker as written in casino records, e.g. BTC. */
  code: z.string().regex(/^[A-Z0-9]{2,10}$/),
  name: z.string().min(1),
  /**
   * Chains this coin can move on, site-wide. A casino's own `currencies[].networks`
   * must be a subset of these codes — validated in scripts/validate-content.ts. Empty
   * for coins that only exist on their own chain (BTC, LTC, DOGE, XRP, BCH, EOS).
   */
  networks: z.array(networkSchema).default([]),
  facetSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  h1: z.string().min(1),
  metaTitle: z.string().min(1).max(70),
  metaDescription: z.string().min(1).max(165),
  intro: z.string().min(1),
  faq: z
    .array(z.object({ q: z.string().min(1), a: z.string().min(1) }))
    .default([]),
});

export type RatingSourceInput = z.input<typeof ratingSourceSchema>;
export type CurrencySupport = z.output<typeof currencySupportSchema>;
export type Casino = z.output<typeof casinoSchema>;
export type Factor = z.output<typeof factorSchema>;
export type Network = z.output<typeof networkSchema>;
export type Currency = z.output<typeof currencySchema>;
