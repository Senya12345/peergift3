# Gamble Atlas

An aggregator of crypto casino ratings. Each casino's score is the plain mean of what
independent review platforms published about it, rebased onto one scale, with every
figure linked back to its source.

Built as a static site because the data changes rarely and Core Web Vitals are a ranking
factor we can win outright.

## Running it

```bash
npm install
npm run dev   # localhost:4321
```

Copy `.env.example` to `.env` and fill in what you need. Every variable has a safe
default; nothing is required for the site to build.

## Verifying

```bash
npm run verify
```

Runs, in order: typecheck, content validation, prose linting, build, and the
placeholder-leak assertion. This is what CI runs.

| Check | Fails on |
|---|---|
| `astro check` | Type errors |
| `validate-content` | Unknown factor or currency, score above its scale, duplicate source, facet slug colliding with a route, missing verification date |
| `slop-lint` | Banned filler phrases, two generated pages sharing more than 70% of their words |
| `assert-no-demo` | A placeholder record reaching `dist/` |

## Two switches that matter

**`SITE_INDEXABLE`** gates the entire site. While it is `false`, every page carries
`noindex` and no sitemap is emitted. Leave it off until the ranking holds enough casinos
to be worth crawling — an empty aggregator that gets indexed earns a thin-content
reputation that takes months to shed.

**`INCLUDE_DEMO`** includes placeholder casino records for layout work, if any exist
under `src/content/casinos/` with `"demo": true`. Never true in a build that ships; CI
asserts it.

## How the pieces fit

Casinos, factors and currencies are JSON files under `src/content/`, validated by Zod
schemas in `src/lib/schemas.ts` and loaded by `src/lib/content.ts`. They are read from
disk rather than through `astro:content` because `astro.config.ts` and the validation
scripts need the same data, and neither can use that API.

The aggregate score is computed at build time in `src/lib/ratings.ts` and never stored,
so the headline number cannot drift from the breakdown printed beneath it. Fewer than
`MIN_RATING_SOURCES` (currently two) sources yields no score at all.

Facet pages (`/no-kyc-crypto-casinos/`, `/bitcoin-casinos/`) are generated for every
factor and currency so the filters always work, but stay `noindex` and out of the sitemap
until they hold five casinos. They promote themselves as the data fills in, with no code
change.

Outbound links go through `/go/{slug}`, a Cloudflare Pages Function that 302s to the
affiliate URL and logs the click server-side. Ad blockers remove a large share of
client-side analytics on gambling sites, so the server count is the only click figure
worth reconciling against affiliate payouts.

## Adding a casino

Give Claude the link, name, sign-up bonus and description; the `add-casino` skill in
`.claude/skills/` handles the rest — researching ratings across the platforms, reading
player reviews to ground the verdict, assigning factors, and writing the file. Its one
hard rule is that no number gets written that was not read from a source.

## Writing anything

Read `docs/voice.md` first, or invoke the `gambleatlas-voice` skill. `docs/design-system.md`
covers the visual side. Both exist for the same reason: this site generates pages from
data, which is the exact shape Google's scaled-content enforcement targets, and
hand-written specific prose is what separates it from a content farm.

## Deploying

Cloudflare Pages. Build command `npm run build`, output `dist/`, functions in
`functions/`. Bind an Analytics Engine dataset as `CLICKS` to record outbound clicks.
