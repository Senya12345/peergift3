/**
 * Eagerly-imported SVG source for every icon under src/assets/coins/, keyed by ticker
 * (uppercase). Coins without a file here (BUSD, CRO, SHIB, TRUMP as of writing — no CC0
 * icon was available for them) fall back to a plain monogram badge in CoinIcon.astro
 * rather than a broken image.
 */
const modules = import.meta.glob('../assets/coins/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const bySymbol = new Map<string, string>();
for (const [path, svg] of Object.entries(modules)) {
  const ticker = path.match(/([a-z0-9]+)\.svg$/)?.[1];
  if (ticker) bySymbol.set(ticker.toUpperCase(), svg);
}

export function coinIconSvg(code: string): string | null {
  return bySymbol.get(code.toUpperCase()) ?? null;
}
