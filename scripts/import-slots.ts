import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds src/content/slots.json from the raw catalogue captures in scripts/seed/slots/.
 *
 * Re-runnable, same philosophy as import-providers.ts: the seeds stay in the repo, so a
 * ninth casino later means dropping in another seed file and running this again rather
 * than hand-merging thousands of rows.
 *
 * The real work here is not parsing — every seed file is already clean JSON, one object
 * per game — it's that no two casinos agree on how to spell a provider. Several ship a
 * `provider` field that is silently wrong: Shuffle's is truncated to the first
 * hyphen-delimited token of its own internal slug ("penguin" for Penguin King, "one" for
 * OneTouch), and BC.Game leaves it null on about half its catalogue. Where a `href` field
 * exists, the real provider is recoverable from it; Rainbet has neither a usable
 * `provider` token nor an `href`, so its truncated tokens are resolved instead by
 * cross-referencing the same game name against casinos that got it right (Stake, 1win,
 * Roobet, Winna) — a title appears at 3-8 casinos on average, and the honest name almost
 * always shows up somewhere.
 *
 * Games are merged across casinos on (canonical provider slug + normalised name), because
 * "Gates of Olympus" and "Gates of Olympus 1000" are different games but "Sweet Bonanza"
 * and "Sweet Bonanza™" are the same one — normalising away trademark marks and casing
 * without touching the actual title text is what keeps that distinction intact.
 */

const root = process.cwd();
const seedDir = path.join(root, 'scripts/seed/slots');
const registryPath = path.join(root, 'src/content/providers.json');

interface RawSlot {
  name: string;
  provider: string | null;
  image: string;
  href?: string;
}

interface ProviderRecord {
  slug: string;
  name: string;
  website: string | null;
  logo: string | null;
  stakeRank: number | null;
  casinos: string[];
  nameReconstructed: boolean;
}

/** Casino seed file -> casino slug, matching src/content/casinos/{slug}.json. */
const CASINO_FILES: Record<string, string> = {
  'stake.json': 'stake',
  '1win.json': '1win',
  'roobet.json': 'roobet',
  'shuffle.json': 'shuffle',
  'bc-game.json': 'bc-game',
  'rainbet.json': 'rainbet',
  'duel.json': 'duel',
  'winna.json': 'winna',
};

/**
 * Icon source priority when the same game is found at several casinos — the user's own
 * call: Stake's captures first, then 1win, then whichever else has it. None of this art
 * belongs to any of these casinos; the only real question is which copy is cleanest.
 */
const ICON_PRIORITY = ['stake', '1win', 'roobet', 'bc-game', 'rainbet', 'shuffle', 'duel', 'winna'];

/** Path prefixes to strip before reading a casino's href, one per source. */
const HREF_STRIP: Record<string, RegExp> = {
  shuffle: /^\/ru\/games\//,
  duel: /^\/casino\/games\//,
  roobet: /^\/casino\/game\//,
  'bc-game': /^\/game\//,
  winna: /^\/ru\/game\/ss\//,
};

/** Merge key: case- and punctuation-insensitive. Same normaliser as import-providers.ts. */
const key = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Same folds import-providers.ts already applies to its two sources, reused here because
 * the slot data hits the identical problem: a casino's own short internal token for a
 * studio ("hacksaw", "relax", "nolimit") doesn't key()-match the fuller name the registry
 * already carries ("Hacksaw Gaming", "Relax Gaming", "Nolimit City"), so a naive lookup
 * mints a second, garbage provider instead of folding into the one that exists.
 */
const BARE_BRAND_ALIASES: Record<string, string> = {
  hacksaw: 'Hacksaw Gaming',
  relax: 'Relax Gaming',
  booming: 'Booming Games',
  '155': '155.io',
  mancala: 'Mancala Gaming',
  '100hp': '100HP Gaming',
  gemini: 'Gemini Gaming',
  nolimit: 'Nolimit City',
  oryx: 'Oryx Gaming',
  elk: 'ELK Studios',
  netent: 'NetEnt',
  playngo: "Play'n GO",
  pgsoft: 'PG Soft',
  turbogames: 'Turbo Games',
  gameart: 'GameArt',
  smartsoft: 'SmartSoft',
  kagaming: 'KA-Gaming',
  topspin: 'TopSpin',
  avatarux: 'AvatarUX',
  voltent: 'VoltEnt',
  bgaming: 'BGaming',
  onetouch: 'OneTouch',
  maxrng: 'MaxRNG',
  iconic21: 'ICONIC21',
  '1x2gaming': '1x2 Gaming',
  popiplay: 'Popiplay',
  shadylady: 'Shady Lady',
};

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Raw provider tokens this import actually observed, resolved by reading each casino's
 * own href where one exists, or (for Rainbet, which has neither) by finding the same game
 * name correctly attributed elsewhere. Keyed by key(rawToken) so punctuation/casing in the
 * source doesn't matter; values are the canonical display name.
 *
 * Every entry below is evidence-based — a href prefix or a cross-casino name match, not a
 * guess — except the handful flagged inline, which are the true tail: a token seen once,
 * kept as its own provider and reported to the user rather than silently merged.
 */
const TOKEN_ALIASES: Record<string, string> = {
  // Shuffle's truncated-to-first-token provider field, confirmed via each game's href.
  penguin: 'Penguin King',
  one: 'OneTouch',
  n: 'N2 Games',
  gaming: 'Gaming Corps',
  peter: 'Peter & Sons',
  shady: 'Shady Lady',
  just: 'Just Slots',
  clutch: 'Clutch Gaming',
  '3': '3 Oaks Gaming',
  '7': '7 Rings',
  '1': '1spin4win',
  // Rainbet has no href; resolved by matching its game titles against Stake/1win/Roobet.
  play: "Play'n GO",
  playn: "Play'n GO",
  red: 'Red Tiger',
  big: 'Big Time Gaming',
  mascot: 'Mascot Gaming',
  retro: 'Retrogaming',
  fantasma: 'Fantasma Games',
  print: 'Print Studios',
  // Confirmed by name against shuffle's "n" (N2 Games) — not a "Backseat Gaming" studio.
  backseat: 'N2 Games',
  // Duel's equivalent truncation, confirmed via its own href.
  nownow: 'Nownow Gaming',
  jinx: 'Jinx Gaming',
  exco: 'Exco Game Studio',
  // Compact keys used by Winna/Shuffle/BC.Game that don't reduce to an existing name
  // under key() alone.
  pragmaticexternal: 'Pragmatic Play',
  pragmatic: 'Pragmatic Play',
  spnmnl: 'Spinomenal',
  bgmng: 'Booming Games',
  hacksawg: 'Hacksaw Gaming',
  bsg: 'Booongo',
  n2games: 'N2 Games',
  '3oaks': '3 Oaks Gaming',
  '7rings': '7 Rings',
  penguinking: 'Penguin King',
  justslots: 'Just Slots',
  shadylady: 'Shady Lady',
  gamingcorps: 'Gaming Corps',
  bigdaddygaming: 'Big Daddy Gaming',
  truelab: 'TrueLab Gaming',
  truelabs: 'TrueLab Gaming',
  truelabgames: 'TrueLab Gaming',
  truelabgaming: 'TrueLab Gaming',
  peterandsons: 'Peter & Sons',
};

/** href-derived provider slugs (dash-joined) not already covered by the 766-entry
 * registry, so the greedy prefix matcher below has something to match against. */
const HREF_SLUG_ALIASES: Record<string, string> = {
  'n-2-games': 'N2 Games',
  'one-touch': 'OneTouch',
  '3-oaks': '3 Oaks Gaming',
  '7-rings': '7 Rings',
  '1-spin-4-win': '1spin4win',
  'gaming-corps': 'Gaming Corps',
  'peter-sons': 'Peter & Sons',
  'shady-lady': 'Shady Lady',
  'just-slots': 'Just Slots',
  'clutch-gaming': 'Clutch Gaming',
  'penguin-king': 'Penguin King',
  'nownow-gaming': 'Nownow Gaming',
  'jinx-gaming': 'Jinx Gaming',
  'exco-game-studio': 'Exco Game Studio',
  'print-studios': 'Print Studios',
  'ruby-play': 'RubyPlay',
  'pg-slots': 'PG Slots',
  'popok-gaming': 'Popok Gaming',
  'funta-gaming': 'Funta Gaming',
  'fa-chai': 'FaChai',
  'real-time-gaming': 'Real Time Gaming',
  'croco-gaming': 'Croco Gaming',
  // Pragmatic's own "POP" sub-line (bingo-style scratch games) — same studio, not a
  // separate one; folding it in avoids the same game splitting into two provider pages
  // depending on which casino's href happened to spell out "pp-pop".
  'pp-pop': 'Pragmatic Play',
  'tada-gaming': 'TaDa Gaming',
};

interface CasinoRecord {
  name: string;
  provider: string | null;
  image: string;
  href?: string;
  position: number;
  total: number;
}

interface Draft {
  name: string;
  providerName: string;
  providerReconstructed: boolean;
  entries: Map<string, CasinoRecord>; // casino -> record
}

// ---- Step 1: load the provider registry, index it for lookup ----

const providers = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as ProviderRecord[];
const providerByKey = new Map<string, ProviderRecord>();
for (const p of providers) providerByKey.set(key(p.name), p);

// A dictionary of dash-joined provider slugs for the href-prefix matcher: every existing
// registry slug plus the aliases this import discovered, longest first so "hacksaw-gaming"
// wins over "hacksaw" when both would match.
const slugDict = new Map<string, string>(); // slug -> canonical name
for (const p of providers) slugDict.set(p.slug, p.name);
for (const [slug, name] of Object.entries(HREF_SLUG_ALIASES)) slugDict.set(slug, name);
// Bare-brand aliases double as href-slug fragments too ("hacksaw-brazil-...", not just
// the raw token "hacksaw"), so the same table feeds both matchers.
for (const [slug, name] of Object.entries(BARE_BRAND_ALIASES)) {
  if (!slugDict.has(slug)) slugDict.set(slug, name);
}
// Defer to the registry's exact spelling wherever an alias's name folds to a studio the
// registry already carries under different casing/punctuation — same reasoning as the
// aliasHit check in resolveToken, applied uniformly to the href-prefix matcher.
for (const [slug, name] of slugDict) {
  const canonical = providerByKey.get(key(name));
  if (canonical && canonical.name !== name) slugDict.set(slug, canonical.name);
}
const slugsByLengthDesc = [...slugDict.keys()].sort((a, b) => b.length - a.length);

const newProviders = new Map<string, { name: string; reconstructed: boolean }>();
const unresolvedProviderNames = new Set<string>();

/** Resolves a raw provider token (from the `provider` field) to a canonical name. */
/**
 * Interface furniture some casinos' own provider filter accidentally leaks into a game
 * row, not a studio — same problem import-providers.ts's STAKE_NON_PROVIDERS solves for
 * the provider-grid capture, here on the slot-catalogue capture instead.
 */
const NON_PROVIDER_TOKENS = new Set(['Игры Stake', 'Движок Stake', 'Только слоты']);

function resolveToken(raw: string): { name: string; reconstructed: boolean } {
  const trimmed = raw.trim().replace(/[\s-](mexico|brazil|korea|philippine|philippines)$/i, '');
  if (NON_PROVIDER_TOKENS.has(trimmed)) return { name: '(unknown)', reconstructed: true };
  const k = key(trimmed);
  const existing = providerByKey.get(k);
  if (existing) return { name: existing.name, reconstructed: existing.nameReconstructed };
  const alias = TOKEN_ALIASES[k] ?? BARE_BRAND_ALIASES[k];
  if (alias) {
    // If the registry already carries this studio under a different exact spelling
    // ("Retro Gaming" vs this table's "Retrogaming"), defer to the registry's spelling
    // rather than minting a second name that folds to the same key but reads differently.
    const aliasHit = providerByKey.get(key(alias));
    return { name: aliasHit ? aliasHit.name : alias, reconstructed: !aliasHit };
  }
  // No match anywhere: treat as its own new provider, best-effort title case.
  unresolvedProviderNames.add(trimmed);
  const titled = trimmed
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
  return { name: titled, reconstructed: true };
}

/**
 * Resolves a provider from a href path: strips the casino's own prefix, then greedily
 * matches the longest known provider slug against the remaining dash/underscore/colon
 * joined path, skipping one trailing region-market token (e.g. "-mexico") if present.
 */
function resolveFromHref(casino: string, href: string): { name: string; reconstructed: boolean } | null {
  const stripRe = HREF_STRIP[casino];
  let rest = stripRe ? href.replace(stripRe, '') : href;
  // Winna encodes as "{providerKey}:{GameSlug}" — the provider half is already exact.
  if (casino === 'winna') {
    const [providerKey] = rest.split(':');
    if (providerKey) return resolveToken(providerKey);
    return null;
  }
  const sep = casino === 'duel' ? '_' : '-';
  const dashForm = rest.split(sep).join('-');
  for (const slug of slugsByLengthDesc) {
    if (dashForm === slug || dashForm.startsWith(`${slug}-`)) {
      return { name: slugDict.get(slug)!, reconstructed: false };
    }
  }
  return null;
}

// ---- Step 2: load seeds, build a name -> provider reference map from the reliable
// sources first, so the two casinos that need cross-referencing (Rainbet, and BC.Game's
// null rows without a usable href) have something to look up. ----

const RELIABLE_CASINOS = new Set(['stake', '1win', 'roobet', 'winna', 'duel', 'bc-game']);

const nameProviderVotes = new Map<string, Map<string, number>>(); // normalizedName -> provider -> count

function normalizedNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[™®]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function vote(name: string, providerName: string) {
  const nk = normalizedNameKey(name);
  let m = nameProviderVotes.get(nk);
  if (!m) {
    m = new Map();
    nameProviderVotes.set(nk, m);
  }
  m.set(providerName, (m.get(providerName) ?? 0) + 1);
}

/**
 * BC.Game has ~550 rows with neither a `name` nor an `image` — the scrape caught the
 * link before the card's content loaded. The href still names the game, so it is
 * recovered from there rather than dropping several hundred real slots outright; there
 * is no icon to show for these until a different casino's copy of the same game backfills
 * one, which the icon-priority pass below already does automatically.
 */
function nameFromHref(href: string): string {
  const slugPart = href
    .replace(/^\/game\//, '')
    .replace(/-by-[a-z0-9-]+$/, '');
  return slugPart
    .split('-')
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

const seedData = new Map<string, RawSlot[]>();
let namesRecoveredFromHref = 0;
for (const [file, casino] of Object.entries(CASINO_FILES)) {
  const data = JSON.parse(fs.readFileSync(path.join(seedDir, file), 'utf8')) as RawSlot[];
  for (const row of data) {
    if (!row.name && row.href) {
      row.name = nameFromHref(row.href);
      namesRecoveredFromHref++;
    }
  }
  seedData.set(casino, data.filter((row) => !!row.name));
}

// First pass over the reliable casinos: resolve providers and record votes by game name.
for (const casino of RELIABLE_CASINOS) {
  const data = seedData.get(casino)!;
  for (const row of data) {
    if (row.provider) {
      const resolved = resolveToken(row.provider);
      vote(row.name, resolved.name);
    } else if (row.href && HREF_STRIP[casino]) {
      const resolved = resolveFromHref(casino, row.href);
      if (resolved) vote(row.name, resolved.name);
    }
  }
}

function bestVote(name: string): string | null {
  const m = nameProviderVotes.get(normalizedNameKey(name));
  if (!m) return null;
  let best: string | null = null;
  let bestCount = 0;
  for (const [prov, count] of m) {
    if (count > bestCount) {
      best = prov;
      bestCount = count;
    }
  }
  return best;
}

// ---- Step 3: resolve every row in every casino to a final provider name. ----

function resolveRow(casino: string, row: RawSlot): { name: string; reconstructed: boolean } {
  // Href-based resolution first where the casino's href is trustworthy (Shuffle, Duel,
  // Roobet, Winna) — it survives the provider field being truncated or absent.
  if (row.href && HREF_STRIP[casino]) {
    const fromHref = resolveFromHref(casino, row.href);
    if (fromHref) return fromHref;
  }
  if (row.provider) {
    const k = key(row.provider.trim());
    // Shuffle's provider field is the truncated-to-first-token slug; if it's a stub the
    // alias table or href already handles it above. A plain match still wins here.
    const resolved = resolveToken(row.provider);
    // Guard: single-dictionary-word stubs ("gaming", "one", "n", "big", "red", "play")
    // that resolveToken would otherwise mint as their own bogus provider — fall through
    // to the cross-reference vote instead of trusting the raw token as a real name.
    if (unresolvedProviderNames.has(row.provider.trim()) && k.length <= 6) {
      const voted = bestVote(row.name);
      if (voted) return { name: voted, reconstructed: false };
    }
    return resolved;
  }
  // No provider field and no usable href (BC.Game's ~5,000 null rows without a "-by-"
  // suffix, or anything else that falls through): cross-reference by name.
  const voted = bestVote(row.name);
  if (voted) return { name: voted, reconstructed: false };
  return { name: '(unknown)', reconstructed: true };
}

// bc-game: recover provider from the "-by-{slug}" href suffix when the field is null.
function bcGameHrefProvider(href: string | undefined): { name: string; reconstructed: boolean } | null {
  if (!href) return null;
  const m = href.match(/-by-([a-z0-9-]+)$/);
  if (!m) return null;
  const slugPart = m[1]!;
  for (const slug of slugsByLengthDesc) {
    if (slugPart === slug || slugPart.startsWith(`${slug}-`)) {
      return { name: slugDict.get(slug)!, reconstructed: false };
    }
  }
  return resolveToken(slugPart.split('-').join(' '));
}

// ---- Step 4: build slot drafts, merging across casinos on provider + normalised name.

const drafts = new Map<string, Draft>();
let bcNullResolvedByHref = 0;
let bcNullResolvedByVote = 0;
let bcNullUnresolved = 0;

for (const [casino, data] of seedData) {
  const total = data.length;
  data.forEach((row, position) => {
    let resolved: { name: string; reconstructed: boolean };
    if (casino === 'bc-game' && !row.provider) {
      const fromHref = bcGameHrefProvider(row.href);
      if (fromHref) {
        resolved = fromHref;
        bcNullResolvedByHref++;
      } else {
        const voted = bestVote(row.name);
        if (voted) {
          resolved = { name: voted, reconstructed: false };
          bcNullResolvedByVote++;
        } else {
          resolved = { name: '(unknown)', reconstructed: true };
          bcNullUnresolved++;
        }
      }
    } else {
      resolved = resolveRow(casino, row);
    }

    if (resolved.name === '(unknown)') return; // can't place a game with no provider at all

    const providerSlug = slugify(resolved.name);
    const nameKey = normalizedNameKey(row.name);
    const draftKey = `${providerSlug}::${nameKey}`;

    let draft = drafts.get(draftKey);
    if (!draft) {
      draft = {
        name: row.name.trim(),
        providerName: resolved.name,
        providerReconstructed: resolved.reconstructed,
        entries: new Map(),
      };
      drafts.set(draftKey, draft);
      if (!providerByKey.has(key(resolved.name)) && !newProviders.has(providerSlug)) {
        newProviders.set(providerSlug, { name: resolved.name, reconstructed: resolved.reconstructed });
      }
    }
    // Prefer a display name from a casino whose provider resolution wasn't reconstructed,
    // and prefer the earliest ICON_PRIORITY casino's own spelling when tied.
    if (!resolved.reconstructed && draft.providerReconstructed) {
      draft.providerName = resolved.name;
      draft.providerReconstructed = false;
    }
    draft.entries.set(casino, { name: row.name.trim(), provider: row.provider, image: row.image, href: row.href, position, total });
  });
}

// ---- Step 5: emit final slot records. ----

const slugCounts = new Map<string, number>();
/**
 * A bare numeric suffix ("-2") is indistinguishable from a real sequel in the title
 * ("Kitsune's Scrolls 2"), so a slug collision — usually the same game with punctuation
 * dropped by one casino's own capture ("Kitsunes Scrolls" vs "Kitsune's Scrolls") — is
 * disambiguated with an unambiguous "-dup2" marker instead, so it can never land on the
 * slug a genuinely different, differently-named game already owns.
 */
function uniqueSlug(base: string): string {
  const count = slugCounts.get(base) ?? 0;
  slugCounts.set(base, count + 1);
  return count === 0 ? base : `${base}-dup${count + 1}`;
}

const slots = [...drafts.values()]
  .map((draft) => {
    const providerSlug = slugify(draft.providerName);
    const baseSlug = slugify(`${draft.providerName} ${draft.name}`);
    const slug = uniqueSlug(baseSlug);

    const availability = [...draft.entries.entries()]
      .map(([casino, rec]) => ({
        casino,
        position: rec.position,
        total: rec.total,
        url: rec.href ? rec.href : null,
      }))
      .sort((a, b) => a.position / a.total - b.position / b.total);

    let icon: string | null = null;
    for (const casino of ICON_PRIORITY) {
      const rec = draft.entries.get(casino);
      if (rec?.image) {
        icon = rec.image;
        break;
      }
    }

    return {
      slug,
      name: draft.name,
      provider: providerSlug,
      releasedAt: null,
      volatility: null,
      maxWin: null,
      screenshots: [],
      summary: null,
      icon,
      availability,
      rtpByCasino: [],
    };
  })
  .sort((a, b) => {
    // Stable, meaningful default order: most-available slots first, then alphabetic.
    if (a.availability.length !== b.availability.length) return b.availability.length - a.availability.length;
    return a.name.localeCompare(b.name);
  });

// ---- Step 6: append newly discovered providers to the registry. ----

let providersAdded = 0;
for (const [slug, info] of newProviders) {
  if (providers.some((p) => p.slug === slug)) continue;
  providers.push({
    slug,
    name: info.name,
    website: null,
    logo: null,
    stakeRank: null,
    casinos: [],
    nameReconstructed: info.reconstructed,
  });
  providersAdded++;
}
providers.sort((a, b) => {
  if (a.stakeRank !== null && b.stakeRank !== null) return a.stakeRank - b.stakeRank;
  if (a.stakeRank !== null) return -1;
  if (b.stakeRank !== null) return 1;
  return a.name.localeCompare(b.name);
});

fs.writeFileSync(registryPath, `${JSON.stringify(providers, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'src/content/slots.json'), `${JSON.stringify(slots, null, 2)}\n`);

// ---- Report ----

const totalRaw = [...seedData.values()].reduce((sum, d) => sum + d.length, 0);
const reconstructed = slots.filter((s) => {
  const p = providers.find((pr) => pr.slug === s.provider);
  return p?.nameReconstructed;
}).length;
const indexableAt3 = slots.filter((s) => s.availability.length >= 3).length;

console.log(`import-slots: ${totalRaw} raw rows across ${seedData.size} casinos -> ${slots.length} unique games`);
console.log(`  ${namesRecoveredFromHref} name(s) recovered from a href (row had no name/image in the scrape)`);
console.log(`  bc-game null-provider rows: ${bcNullResolvedByHref} via href, ${bcNullResolvedByVote} via cross-reference, ${bcNullUnresolved} unresolved (dropped)`);
console.log(`  ${providersAdded} new provider(s) added to the registry (${[...newProviders.values()].filter((p) => p.reconstructed).length} best-effort spelling, unconfirmed)`);
console.log(`  ${reconstructed} slot(s) carry an unconfirmed provider name`);
console.log(`  ${indexableAt3} of ${slots.length} slots are at 3+ casinos (the indexing threshold)`);
console.log(`  unresolved provider tokens seen (kept as their own new provider): ${unresolvedProviderNames.size}`);
