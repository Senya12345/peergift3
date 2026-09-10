---
name: gambleatlas-voice
description: The editorial rules for any prose published on the Gamble Atlas site — casino verdicts, facet page intros, articles, and the written pages. Use before writing or editing any user-facing copy in this repository, including meta titles and descriptions.
---

# Writing for Gamble Atlas

Full rules live in `docs/voice.md`. Read it before writing anything substantial. This is
the working summary.

## Why the rules exist

Google has no AI-detector and never has; authorship is not a ranking signal. What the
March 2026 core update punished was **scaled content abuse** — templated pages produced at
volume, recognisable by coordinated sameness. Gamble Atlas generates pages from data, which is
that exact shape. The prose is what separates us from a penalised content farm, so it
carries the whole load.

## Non-negotiables

1. **Never invent a number.** No rating, bonus figure, wagering requirement, licence
   number or payout time unless it was read from a real source. Omit and report instead.
2. **Every claim checkable** — traceable to the operator's site, a named platform, or our
   own documented test.
3. **300+ words** of real body copy on any indexable page.
4. **Any two generated pages differ in most of their words.** `slop-lint` fails the build
   below 30% uniqueness and warns below 40%.

## Banned phrases — these fail the build

`delve into` · `it's important to note` · `in today's fast-paced world` ·
`ever-evolving landscape` · `it's no secret that` · `when it comes to` ·
`look no further` · `unlock the potential` · `game-changer` · `seamless` · `robust` ·
`elevate your` · `navigate the world of` · `in conclusion` · `that being said` ·
`a testament to`

They are the words a writer reaches for when there is nothing specific to say. The fix is
never a synonym — it is a fact.

## Specificity

Every paragraph about a casino carries at least one concrete, checkable detail.

> ❌ Fast withdrawals and a generous welcome bonus make this a solid choice.

> ✅ Withdrawals to BTC cleared in under ten minutes across three test cashouts in March
> 2026, though the network fee comes out of the player's side. The welcome bonus is 200%
> up to 1 BTC at 40× wagering — high enough to be worth reading the terms first.

## Cons must come from evidence

Not "could use more games". Instead: a complaint that recurs across two or more platforms,
a term buried in the bonus conditions, an unverifiable licence, a coin advertised but
absent from the terms. If nothing is wrong, say what you checked — do not manufacture a
flaw for symmetry.

## Rhythm

Even rhythm is the loudest machine tell.

- Vary paragraph and section lengths across a page. One-sentence paragraphs are good.
- **Break the rule of three.** Lists run 2, 5, 7 — whatever is true. Three of anything in
  a row is the most recognisable generated shape on the web.
- Vary sentence length. Long qualified sentences next to short ones.
- No two consecutive sections opening with the same construction.

## Voice

First person plural with actual opinions: *we checked*, *we could not confirm*, *we would
avoid*. Never second-person marketing. Hedging is a strength — "we could not verify the
Curaçao licence number in their footer" beats both pretending it checks out and implying
fraud.

We are paid by these operators, and we say so plainly. That candour is part of the voice,
not a disclaimer bolted on.

## Before publishing

```bash
npm run slop-lint
```

Then ask the standalone value test: **would this page be worth publishing if no similar
page existed?** If not, it is not ready.
