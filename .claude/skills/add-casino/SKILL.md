---
name: add-casino
description: Add a casino to Gamble Atlas from a link, name, bonus and description supplied by the operator of the site. Researches the casino's ratings across the review platforms, reads player reviews to ground the editorial verdict, assigns factors, and writes the content file. Use whenever a new casino is being added or an existing record is being re-verified.
---

# Adding a casino to Gamble Atlas

The user supplies: **link, name, sign-up bonus, description**. Everything else — the
ratings, the player sentiment, the factors — you research.

## The one rule that outranks the rest

**Never write a number you did not read from a source.**

Not an estimate, not a plausible figure, not a value inferred from similar casinos. If a
platform does not list this casino, it does not go in the file. If a bonus term cannot be
confirmed on the operator's own site, it is left out. A wrong figure here is not a small
error: the entire premise of Gamble Atlas is that every number is checkable, and one invented
score makes the rest worthless.

When something cannot be found, say so in your report. Silence looks like completeness.

## Step 1 — research the ratings

Search each platform for the casino and record what it currently publishes:

| Platform | `id` | Scale | Metric it publishes |
|---|---|---|---|
| AskGamblers | `askgamblers` | 10 | **Player rating only** — not CasinoRank |
| Casino Guru | `casinoguru` | 10 | **Safety Index** — not a satisfaction score |
| Trustpilot | `trustpilot` | 5 | Customer sentiment |
| Casinomeister | `casinomeister` | 10 | Editorial rating |
| LCB | `lcb` | 5 | Player rating |
| Bitcoin.com Games | `bitcoincom` | 10 | Editorial rating |

For each hit, capture the score, the **deep link to that casino's page** on the platform,
and today's date as `verifiedAt`. Confirm the scale from the page rather than assuming it
— a platform that shows 4.2 out of 5 and one that shows 4.2 out of 10 are very different
casinos.

**AskGamblers shows two different numbers and they can diverge sharply** — CasinoRank
(its own algorithmic score, blending business factors it doesn't fully disclose) and
Player Rating (the plain average of submitted reviews, with a review count attached).
This site records Player Rating, consistently, for every casino — not whichever one a
search snippet happens to surface first. A real case that shows why this matters: one
casino scored 2.8 CasinoRank against 9.6 Player Rating on the same page. Grabbing
whichever number appears first in a search result silently changes the methodology
casino to casino, and the aggregate stops meaning anything comparable.

Fewer than two platforms found (`MIN_RATING_SOURCES` in `src/lib/schemas.ts`)? The
record is still valid, but it will render as unrated. Report that explicitly, because
it is usually a signal in itself: a casino no major platform has reviewed is either
very new or deliberately obscure.

## Step 2 — read the player reviews

Read the actual complaints and praise on those platforms. You are not copying any of it —
copying review text is duplicate content and a terms breach on most of those sites. You
are looking for the recurring pattern that turns into our own prose:

- What do complaints cluster around? Withdrawal delays, closed accounts, bonus voiding,
  support silence?
- How does the operator respond publicly, if at all?
- What do satisfied players consistently mention?

A complaint appearing once is an anecdote. The same complaint appearing across two
platforms is a `con`.

## Step 3 — assign factors

Determine the factors from the casino's own site and terms, not from its marketing copy.

- A factor that already exists in `src/content/factors/` — add its slug to the casino.
- A genuinely new factor — create `src/content/factors/{slug}.json`. It needs `name`,
  `facetSlug`, `h1`, `metaTitle` (≤70 chars), `metaDescription` (≤165), a **300+ word
  `intro` written from scratch**, and a few real `faq` entries. Ask the user to confirm
  the factor's name before creating it; a near-duplicate factor ("no KYC" alongside "no
  verification") splits the facet and weakens both pages.

**Never take the user's word for a factor that carries a compliance claim.** "No KYC,"
"instant withdrawal," "no verification" — these are exactly the claims worth checking
independently before tagging them, because they are also exactly the claims a casino's
own marketing overstates. If research contradicts what the user told you (a jurisdiction
tightened AML rules, a watchdog flags weak KYC practice), do not tag the factor — say so
in the report instead. Getting this wrong is worse than an ordinary factual error: it is
the kind of claim a reader might act on financially.

## Step 3.5 — currencies and networks

Currencies are richer than a bare list. Each entry on a casino record is:

```json
{ "code": "USDT", "networks": ["ERC20", "BSC", "POL", "TRX", "SOL"], "minDeposit": null, "minWithdrawal": null }
```

- `code` must match a file in `src/content/currencies/`. If the coin has no file yet,
  create one — `name`, `networks` (the coin's full site-wide network list, an array of
  `{code, name}`; empty for single-chain coins like BTC or XRP), `facetSlug`, `h1`,
  `metaTitle`, `metaDescription`, and a **300+ word, genuinely distinct `intro`**. Twenty
  near-identical altcoin pages is exactly the scaled-content pattern this site exists to
  avoid — each intro needs a real angle (fee structure, speed, volatility, a network
  quirk), not the same paragraph with the ticker swapped. `slop-lint`'s uniqueness check
  will catch a lazy one, but do not rely on the linter to do the thinking.
- `networks` on the *casino* record is the subset of that coin's global networks this
  specific casino actually offers — never the full list by default. Every network code
  used here must appear in the coin's own file, or `validate-content` fails the build.
- Leave `minDeposit` / `minWithdrawal` `null`. The schema still carries them, but across
  every casino added so far real sourced figures existed for at most two of seven, which
  wasn't enough coverage to be useful — the site no longer displays them, so don't spend
  research time chasing one.

## Step 3.6 — software providers

Search for the casino's own providers page (many run one, e.g. `bc.game/providers`,
`shuffle.com/casino/providers`, `roobet.com/provider/{slug}`) or a review that lists
confirmed studios by name. Write `providers` as a plain array of studio names, e.g.
`["Pragmatic Play", "Evolution", "Hacksaw Gaming"]` — no game counts, no exclusivity
claims, nothing beyond the name unless a source states it. A generic "best providers
of 2026" listicle is not a source for *this* casino; only include a studio you found
confirmed specifically for the casino you're adding. If you can only confirm one or
two providers, write those two rather than padding the list, and say so in the report
— thin provider data is exactly the kind of gap Step 6 exists to surface, not to
quietly fill with plausible names. Leave `providers: []` rather than guessing if
nothing checkable turns up.

## Step 4 — write the editorial

Read `docs/voice.md` first and follow it exactly. In short:

- `summary`: 400–700 words. Open with what this casino is for and who should skip it.
  Never open with "X is an online crypto casino that offers".
- `pros`: at least 3, each concrete.
- `cons`: at least 2, each traceable to evidence. Manufactured balance is worse than none.
- Every paragraph carries a checkable fact: an amount, a percentage, a duration, a licence
  identifier, a date.

## Step 4.5 — the AI summary

`aiSummary` is a separate, explicitly-labelled block — three short paragraphs
(`withdrawals`, `deposits`, `commonProblems`) synthesised from what the sources in Step 1
and 2 actually said, dated `generatedAt`. It is not the editorial voice: it can hedge
plainly ("reported minimums vary by source"), and it renders on the page under a visible
"AI-generated" badge, on purpose — the transparency is the point, not a formality.
Ground every sentence in what you actually found; this block is not exempt from the
never-invent-a-number rule just because it is labelled.

## Step 4.6 — logo

Leave `logo: null` and don't spend time chasing one. Two separate reasons, not one:

1. **Technical.** This environment's egress allowlist reaches almost nothing —
   `raw.githubusercontent.com` works, jsDelivr/unpkg/githack/Wikimedia/Clearbit/
   Brandfetch and every casino's own domain do not. No casino brand mark lives on the
   one host that's reachable.
2. **Even where reachable, a brand mark isn't the same category as the coin icons.**
   The crypto icon set in `src/assets/coins/` is CC0 — explicitly public domain,
   checked before use. An operator's logo is a trademark. Pulling one from Wikimedia
   Commons or a logo-aggregator site without checking its actual licence is a real risk,
   not a formality, and more so for an operator already under legal or regulatory
   scrutiny.

If the user wants a real logo, the fix is asking them to supply the file — they can
reach the operator's own site or press kit; this environment cannot. Report the gap,
don't silently work around it, and don't re-litigate this per casino.

## Step 5 — write the file and verify

Create `src/content/casinos/{slug}.json` matching the schema in `src/lib/schemas.ts`.
Set `affiliateUrl` to `null` unless the user supplied one. Never set `demo: true` on a
real casino.

Then run, and do not report success until all three pass:

```bash
npm run validate
npm run slop-lint
npm run build
```

## Step 6 — report

Tell the user:

1. Which platforms had the casino and which did not
2. The computed aggregate (or that it is unrated, and why)
3. Any factor or currency file you created
3.5. How many providers you could confirm, and whether the list is thin
4. **Everything you could not verify** — an unconfirmed licence number, a bonus term that
   is not stated anywhere, a coin listed on the payments page but missing from the terms
5. **Any factor the user asked for that you did not tag**, and why — especially a
   compliance claim like no-KYC that research contradicted. Do not silently drop it;
   say it plainly, the same way you'd flag a number you couldn't confirm
6. Anything that made you uneasy, whether or not it is in the file

Point 4 and point 5 are the ones people skip. Between them, they are the most useful part
of the report.
