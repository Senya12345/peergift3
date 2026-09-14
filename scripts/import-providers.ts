import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds src/content/providers.json from the raw captures in scripts/seed/.
 *
 * Re-runnable: the seeds stay in the repo, so adding a third casino's provider list later
 * means dropping in another seed and running this again rather than hand-merging 400 rows.
 *
 * Three problems in the raw data this exists to solve:
 *
 * 1. Stake's capture is full of `game_kurator_group.*` — unresolved i18n keys leaking from
 *    its own UI, not names. They are recoverable by de-slugging, and a good number are
 *    confirmed by appearing properly spelled in the 1win list.
 * 2. Stake also lists its own UI categories among the providers ("Игры Stake", "Только
 *    слоты"). Those are not studios and are dropped.
 * 3. The two sources disagree on spelling for the same company — Netent/NetEnt,
 *    Hacksaw/Hacksaw Gaming, Relax/Relax Gaming. Without folding those together the same
 *    studio would appear twice in the grid.
 */

const root = process.cwd();
const seedDir = path.join(root, 'scripts/seed');

interface StakeRow {
  name: string;
  logo: string;
}

const stakeSeed = JSON.parse(fs.readFileSync(path.join(seedDir, 'stake-providers.json'), 'utf8')) as {
  providers: StakeRow[];
};
const oneWinSeed = JSON.parse(fs.readFileSync(path.join(seedDir, '1win-providers.json'), 'utf8')) as {
  names: string[];
};

/**
 * Stake rows that are its own interface furniture rather than a studio. Matched on the
 * exact captured string, so a real provider can never be dropped by a loose pattern.
 */
const STAKE_NON_PROVIDERS = new Set(['Игры Stake', 'Движок Stake', 'Только слоты']);

/**
 * Folded into one record despite different merge keys, because they are the same company
 * written two ways across the two sources. Key is the canonical name.
 */
const MERGE_ALIASES: Record<string, string[]> = {
  'Hacksaw Gaming': ['hacksaw'],
  'Relax Gaming': ['relax'],
  'Booming Games': ['booming'],
  '155.io': ['155'],
  'Mancala Gaming': ['mancala', 'mancalagaming'],
  '100HP Gaming': ['100hp'],
  'Gemini Gaming': ['gemini'],
};

/**
 * Preferred spelling where the sources disagree or a de-slugged key loses the real casing.
 * Everything not listed keeps the 1win spelling when present (its capture is properly
 * cased) and otherwise the cleaned Stake one.
 */
const NAME_OVERRIDES: Record<string, string> = {
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

/**
 * Official sites, added only where the address is well known and unambiguous. A wrong
 * outbound link is worse than no link, so anything uncertain stays null rather than being
 * guessed from the company name.
 */
const WEBSITES: Record<string, string> = {
  'pragmatic-play': 'https://www.pragmaticplay.com',
  'hacksaw-gaming': 'https://www.hacksawgaming.com',
  evolution: 'https://www.evolution.com',
  netent: 'https://www.netent.com',
  'nolimit-city': 'https://www.nolimitcity.com',
  'playn-go': 'https://www.playngo.com',
  'relax-gaming': 'https://www.relax-gaming.com',
  'push-gaming': 'https://www.pushgaming.com',
  bgaming: 'https://www.bgaming.com',
  thunderkick: 'https://www.thunderkick.com',
  'red-tiger': 'https://www.redtiger.com',
  'big-time-gaming': 'https://www.bigtimegaming.com',
  yggdrasil: 'https://www.yggdrasilgaming.com',
  betsoft: 'https://www.betsoftgaming.com',
  endorphina: 'https://www.endorphina.com',
  habanero: 'https://www.habanerosystems.com',
  quickspin: 'https://www.quickspin.com',
  blueprint: 'https://www.blueprintgaming.com',
  novomatic: 'https://www.novomatic.com',
  spinomenal: 'https://www.spinomenal.com',
  playson: 'https://www.playson.com',
  'print-studios': 'https://www.printstudios.com',
  'games-global': 'https://www.gamesglobal.com',
  'pg-soft': 'https://www.pgsoft.com',
  spribe: 'https://www.spribe.co',
  evoplay: 'https://evoplay.games',
  amusnet: 'https://www.amusnet.com',
  '3-oaks-gaming': 'https://3oaksgaming.com',
  'gaming-corps': 'https://www.gamingcorps.com',
  slotmill: 'https://www.slotmill.com',
  avatarux: 'https://www.avatarux.com',
  'fantasma-games': 'https://www.fantasmagames.com',
  platipus: 'https://platipusgaming.com',
  ezugi: 'https://www.ezugi.com',
  swintt: 'https://www.swintt.com',
  kalamba: 'https://www.kalambagames.com',
  'tom-horn-gaming': 'https://www.tomhorngaming.com',
  onetouch: 'https://www.onetouch.io',
  'booming-games': 'https://www.booming-games.com',
  gameart: 'https://www.gameart.net',
  skywind: 'https://www.skywindgroup.com',
  'nucleus-gaming': 'https://www.nucleusgaming.com',
};

/** Merge key: case- and punctuation-insensitive, so "Play'n GO" meets "Play'n Go". */
const key = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Recovers a display name from an unresolved i18n key. Best effort, not authoritative. */
function deslug(raw: string): string {
  return raw
    .replace(/^game_kurator_group\./, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const aliasToCanonical = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(MERGE_ALIASES)) {
  for (const alias of aliases) aliasToCanonical.set(alias, key(canonical));
  // The canonical spelling in MERGE_ALIASES is by definition the preferred one, so it
  // also outranks the usual "prefer the 1win capture" rule — otherwise folding
  // "Hacksaw Gaming" and "Hacksaw" together would keep the shorter, worse name.
  NAME_OVERRIDES[key(canonical)] = canonical;
}
/** Resolves a raw merge key to the canonical one it should fold into. */
const canonicalKey = (raw: string): string => aliasToCanonical.get(raw) ?? raw;

interface Draft {
  name: string;
  fromOneWin: boolean;
  logo: string | null;
  stakeRank: number | null;
  casinos: Set<string>;
  deslugged: boolean;
}

const drafts = new Map<string, Draft>();

function upsert(rawName: string, opts: { casino: string; logo?: string; rank?: number; fromOneWin?: boolean; deslugged?: boolean }) {
  const name = rawName.trim();
  const k = canonicalKey(key(name));
  const existing = drafts.get(k);

  if (!existing) {
    drafts.set(k, {
      name,
      fromOneWin: opts.fromOneWin ?? false,
      logo: opts.logo ?? null,
      stakeRank: opts.rank ?? null,
      casinos: new Set([opts.casino]),
      deslugged: opts.deslugged ?? false,
    });
    return;
  }

  existing.casinos.add(opts.casino);
  if (opts.logo && !existing.logo) existing.logo = opts.logo;
  if (opts.rank !== undefined && existing.stakeRank === null) existing.stakeRank = opts.rank;
  // A properly cased 1win name beats a Stake spelling or a de-slugged reconstruction.
  if (opts.fromOneWin && !existing.fromOneWin) {
    existing.name = name;
    existing.fromOneWin = true;
    existing.deslugged = false;
  }
}

let skipped = 0;
let deslugged = 0;

stakeSeed.providers.forEach((row, index) => {
  if (STAKE_NON_PROVIDERS.has(row.name)) {
    skipped++;
    return;
  }
  const isKey = row.name.startsWith('game_kurator_group.');
  if (isKey) deslugged++;
  upsert(isKey ? deslug(row.name) : row.name, {
    casino: 'stake',
    logo: row.logo,
    rank: index,
    deslugged: isKey,
  });
});

for (const name of oneWinSeed.names) {
  upsert(name, { casino: '1win', fromOneWin: true });
}

const providers = [...drafts.entries()]
  .map(([k, draft]) => {
    const name = NAME_OVERRIDES[k] ?? draft.name;
    const slug = slugify(name);
    return {
      slug,
      name,
      website: WEBSITES[slug] ?? null,
      logo: draft.logo,
      // Stake's own ordering, kept as the display rank. It is Stake's commercial
      // curation rather than a measured popularity figure — treated as a reasonable
      // proxy, not presented to readers as a ranking.
      stakeRank: draft.stakeRank,
      casinos: [...draft.casinos].sort(),
      // Flags a name reconstructed from an i18n key, so a later pass can confirm spelling
      // against the studio itself instead of trusting the reconstruction silently.
      nameReconstructed: draft.deslugged,
    };
  })
  .sort((a, b) => {
    if (a.stakeRank !== null && b.stakeRank !== null) return a.stakeRank - b.stakeRank;
    if (a.stakeRank !== null) return -1;
    if (b.stakeRank !== null) return 1;
    return a.name.localeCompare(b.name);
  });

const bySlug = new Map<string, string>();
for (const p of providers) {
  const clash = bySlug.get(p.slug);
  if (clash) throw new Error(`slug collision: "${p.slug}" from both "${clash}" and "${p.name}"`);
  bySlug.set(p.slug, p.name);
}

const out = path.join(root, 'src/content/providers.json');
fs.writeFileSync(out, `${JSON.stringify(providers, null, 2)}\n`);

const bothSources = providers.filter((p) => p.casinos.length > 1).length;
console.log(
  `import-providers: ${providers.length} providers -> ${path.relative(root, out)}\n` +
    `  ${skipped} Stake UI rows dropped, ${deslugged} i18n keys de-slugged, ` +
    `${bothSources} confirmed by both sources, ${providers.filter((p) => p.website).length} with an official site`,
);
