---
name: add-casino
description: Add a casino to Casilla from a link, name, bonus and description supplied by the operator of the site. Researches the casino's ratings across the review platforms, reads player reviews to ground the editorial verdict, assigns factors, and writes the content file. Use whenever a new casino is being added or an existing record is being re-verified.
---

# Adding a casino to Casilla

The user supplies: **link, name, sign-up bonus, description**. Everything else — the
ratings, the player sentiment, the factors — you research.

## The one rule that outranks the rest

**Never write a number you did not read from a source.**

Not an estimate, not a plausible figure, not a value inferred from similar casinos. If a
platform does not list this casino, it does not go in the file. If a bonus term cannot be
confirmed on the operator's own site, it is left out. A wrong figure here is not a small
error: the entire premise of Casilla is that every number is checkable, and one invented
score makes the rest worthless.

When something cannot be found, say so in your report. Silence looks like completeness.

## Step 1 — research the ratings

Search each platform for the casino and record what it currently publishes:

| Platform | `id` | Scale | Metric it publishes |
|---|---|---|---|
| AskGamblers | `askgamblers` | 10 | Editorial + player rating |
| Casino Guru | `casinoguru` | 10 | **Safety Index** — not a satisfaction score |
| Trustpilot | `trustpilot` | 5 | Customer sentiment |
| Casinomeister | `casinomeister` | 10 | Editorial rating |
| LCB | `lcb` | 5 | Player rating |
| Bitcoin.com Games | `bitcoincom` | 10 | Editorial rating |

For each hit, capture the score, the **deep link to that casino's page** on the platform,
and today's date as `verifiedAt`. Confirm the scale from the page rather than assuming it
— a platform that shows 4.2 out of 5 and one that shows 4.2 out of 10 are very different
casinos.

Fewer than three platforms found? The record is still valid, but it will render as
unrated. Report that explicitly, because it is usually a signal in itself: a casino no
major platform has reviewed is either very new or deliberately obscure.

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

Same for currencies in `src/content/currencies/`. Every coin listed on a casino must have
a currency file, or `validate-content` fails the build.

## Step 4 — write the editorial

Read `docs/voice.md` first and follow it exactly. In short:

- `summary`: 400–700 words. Open with what this casino is for and who should skip it.
  Never open with "X is an online crypto casino that offers".
- `pros`: at least 3, each concrete.
- `cons`: at least 2, each traceable to evidence. Manufactured balance is worse than none.
- Every paragraph carries a checkable fact: an amount, a percentage, a duration, a licence
  identifier, a date.

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
4. **Everything you could not verify** — an unconfirmed licence number, a bonus term that
   is not stated anywhere, a coin listed on the payments page but missing from the terms
5. Anything that made you uneasy, whether or not it is in the file

Point 4 is the one people skip. It is the most useful part of the report.
