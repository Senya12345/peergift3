import type { APIRoute } from 'astro';
import { loadCasinos } from '../lib/content';
import { getFacets } from '../lib/facets';
import { aggregateScore } from '../lib/ratings';
import { byScoreDesc } from '../lib/ratings';
import { SITE, SOURCE_PLATFORMS } from '../lib/site';

/**
 * llms.txt gives AI search a clean statement of what this site is and how its numbers
 * are produced. The methodology paragraph matters more than the link list: a model
 * deciding whether to cite us needs to know the score is a mean of named third-party
 * figures, not an opinion we invented.
 */
export const GET: APIRoute = () => {
  const casinos = [...loadCasinos()].sort(byScoreDesc);
  const facets = getFacets().filter((f) => f.indexable);

  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    '## How the score is produced',
    '',
    `Each casino's score is the unweighted mean of ratings published by independent review platforms (${SOURCE_PLATFORMS.join(', ')}), rebased onto a 0-10 scale. Scores from platforms using a 5-point scale are doubled. A casino with fewer than three sources is shown as unrated rather than averaged. Every individual figure is displayed with the date it was checked and a link to the source, so any number on this site can be verified independently.`,
    '',
    `Casilla is an affiliate site: it earns commission on sign-ups. Commission does not affect the ranking, which follows the aggregated scores.`,
    '',
    '## Pages',
    '',
    `- [Ranking](${SITE.url}/): all casinos ordered by aggregate score`,
    `- [Methodology](${SITE.url}/methodology/): how scores are calculated and what they exclude`,
    `- [Responsible gambling](${SITE.url}/responsible-gambling/)`,
  ];

  if (facets.length) {
    lines.push('', '## Lists', '');
    for (const f of facets) {
      lines.push(`- [${f.h1}](${SITE.url}/${f.slug}/): ${f.casinos.length} casinos`);
    }
  }

  if (casinos.length) {
    lines.push('', '## Casinos', '');
    for (const c of casinos) {
      const score = aggregateScore(c);
      lines.push(
        `- [${c.name}](${SITE.url}/casinos/${c.slug}/): ${score === null ? 'unrated' : `${score.toFixed(1)}/10`}`,
      );
    }
  }

  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
