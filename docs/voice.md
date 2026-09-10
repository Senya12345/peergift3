# Gamble Atlas editorial voice

Every word of prose on this site is written against this file. It is not a style
preference — it is the main defence against the one thing that can kill this project.

## Why this file exists

Google does not run an "is this AI?" detector, and never has. Authorship is not a
ranking signal. What the March 2026 core update punished was **scaled content abuse**:
templated mass production. Sites publishing generated pages at volume lost 50–80% of
organic traffic in two weeks. The trigger is coordinated sameness — identical structure,
recycled phrasing, template boilerplate wearing different keywords.

Gamble Atlas generates pages from data. That is exactly the shape Google's enforcement is
tuned to catch. The only thing separating us from a penalised content farm is that
**every page carries prose a person actually wrote, about that specific subject, with
facts a reader could go and check.**

Layout is generated. Data is generated. Prose is not.

## Non-negotiables

1. **Never invent a number.** No rating, bonus amount, wagering requirement, licence
   number, or withdrawal time gets written unless it was read from a real source. If it
   could not be found, the field is omitted and the omission is reported. A fabricated
   figure in a YMYL niche does not make a page slightly wrong — it makes the domain
   untrustworthy.
2. **Every claim is checkable.** If a sentence cannot be traced to the casino's own site,
   a named review platform, or our own documented test, it does not ship.
3. **Uniqueness floor.** Any two generated pages must share less than 60% of their prose.
   Below 40% uniqueness the build warns; below 30% it fails. Enforced by
   `scripts/slop-lint.ts`.
4. **Minimum 300 words** of genuine body copy per indexable page. Shorter pages stay
   `noindex` until they earn their place.
5. **Standalone value test.** Before publishing any page, ask: *would this be worth
   publishing if no similar page existed?* If no, it is not ready.

## Banned phrases

`scripts/slop-lint.ts` fails the build on these. They are the fingerprints of averaged
prose — the phrases a model reaches for when it has nothing specific to say.

| Banned | Why |
|---|---|
| delve into | Nobody has ever said this out loud |
| it's important to note | If it's important, just say it |
| in today's fast-paced world | Says nothing |
| ever-evolving landscape | Says nothing, twice |
| it's no secret that | Filler before the actual sentence |
| when it comes to | Filler; cut it and the sentence improves |
| look no further | Ad copy, not editorial |
| unlock the potential | Means nothing here |
| game-changer | Means nothing anywhere |
| seamless | Almost always replacing a real detail |
| robust | Same |
| elevate your | Same |
| navigate the world of | Same |
| in conclusion | Just conclude |
| whether you're a … or a … | The universal filler opener |
| that said / that being said | Rhythm padding |
| a testament to | Never once literal |

The list grows. When a phrase starts appearing in our own drafts more than twice,
it goes in.

## Specificity

Every paragraph about a casino carries at least one concrete, checkable fact: an amount,
a percentage, a duration, a coin, a licence identifier, or a date.

> ❌ Fast withdrawals and a generous welcome bonus make this a solid choice for crypto
> players.

> ✅ Withdrawals to BTC cleared in under ten minutes across three test cashouts in
> March 2026, though the network fee is deducted from the player's side. The welcome
> bonus is 200% up to 1 BTC with a 40× wagering requirement — high enough that it is
> worth reading the terms before opting in.

The second version is longer because it says something. Length is never the goal;
specificity is, and specificity costs words.

## Cons must be real

Fake balance is worse than no balance — readers spot it instantly and it is exactly what
an affiliate site is expected to do.

> ❌ The site could benefit from more game variety.

> ✅ Support is Telegram-only with no email fallback, and the most common complaint
> across AskGamblers and Trustpilot is unanswered tickets during weekends.

A con should come from evidence: a recurring complaint in player reviews, a term buried
in the bonus conditions, a missing licence, a coin they claim to support but do not.
If we genuinely found nothing wrong, we say so and explain what we checked — we do not
manufacture a flaw.

## Rhythm

Even rhythm is the loudest machine tell. Vary deliberately.

- Paragraph lengths must differ across a page. One-sentence paragraphs are allowed and
  encouraged for emphasis.
- No page where every section is roughly the same length.
- **Break the rule of three.** Lists should be their natural length: two items, five,
  seven. Three feature blocks in a row is the single most recognisable generated-content
  shape on the web.
- Sentence length varies. Long, qualified sentences that carry a condition and its
  exception belong next to short ones. Like this.
- No section may open with the same construction as the section above it.

## Voice

First person plural, as an editorial team with opinions: *we checked*, *we could not
confirm*, *we would avoid*. Never second-person marketing ("you'll love"). Never
breathless. The register is a well-informed friend who has actually used these sites and
is not being paid to like them — even though, per our affiliate disclosure, we are paid
when you sign up. Saying that plainly is part of the voice.

Hedging is allowed and often required. "We could not verify the Curaçao licence number
listed in their footer" is a stronger sentence than either pretending it checks out or
pretending it is fraudulent.

## Per page type

**Casino page** — 400–700 words of editorial. Opens with what this casino is actually
for and who should skip it. Then the specifics: coins, withdrawal behaviour, bonus terms
in plain language, licence status, what players complain about. Ends with a plain verdict.
Never opens with the casino's name followed by "is an online crypto casino that offers".

**Facet page** — 300–500 word intro that answers the query behind the facet before
listing anything. `/no-kyc-crypto-casinos/` explains what no-KYC actually means in
practice, where the limits are, and what the real risk is — then the list. The intro
must be genuinely different from every other facet intro, not the same paragraph with
the factor name swapped.

**Article** — no minimum, but a real thesis. Articles exist to answer a question we keep
seeing, not to hit a publishing cadence. Signed by a real author entity with a bio page.

## Pre-publish checklist

- [ ] Every number traced to a source
- [ ] At least one checkable fact per paragraph
- [ ] Cons come from evidence, not symmetry
- [ ] No banned phrase (`slop-lint` passes)
- [ ] Paragraph and section lengths vary
- [ ] No three-item feature row
- [ ] Passes the standalone value test
- [ ] `verifiedAt` set to the date the facts were actually checked
