/** Single source of truth for the things that appear in metadata, schema and copy. */
export const SITE = {
  name: 'Casilla',
  /** Overridden per environment; the placeholder makes an unset SITE_URL obvious. */
  url: process.env.SITE_URL ?? 'https://casilla.example',
  tagline: 'Crypto casino ratings, with the sources shown',
  description:
    'Casilla combines the published ratings of several independent casino review platforms into one score per crypto casino, and links back to every figure so it can be checked.',
  email: 'pencasino@gmail.com',
  locale: 'en',
} as const;

/** Platforms whose published scores feed the aggregate. Named on /methodology/. */
export const SOURCE_PLATFORMS = [
  'AskGamblers',
  'Casino Guru',
  'Trustpilot',
  'Casinomeister',
  'LCB',
  'Bitcoin.com Games',
] as const;

export function absolute(path: string): string {
  return new URL(path, SITE.url).href;
}
