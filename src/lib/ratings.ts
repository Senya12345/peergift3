import {
  MIN_RATING_SOURCES,
  RATING_SOURCES,
  type Casino,
  type RatingSourceId,
} from './schemas';

export interface NormalisedSource {
  id: RatingSourceId;
  name: string;
  label: string;
  abbr: string;
  /** The figure as the source publishes it. */
  raw: number;
  scale: 5 | 10;
  /** Same figure rebased to /10 so sources are comparable. */
  normalised: number;
  url: string;
  verifiedAt: string;
}

/** Rebase a source's figure onto a 0–10 scale. */
export function normalise(score: number, scale: 5 | 10): number {
  return scale === 10 ? score : (score / 5) * 10;
}

export function normaliseSources(casino: Casino): NormalisedSource[] {
  return casino.ratings.sources.map((s) => ({
    id: s.id,
    ...RATING_SOURCES[s.id],
    raw: s.score,
    scale: s.scale,
    normalised: normalise(s.score, s.scale),
    url: s.url,
    verifiedAt: s.verifiedAt,
  }));
}

/**
 * The headline number, computed at build time from the sources and never stored.
 * Storing it by hand is how a displayed average drifts away from the breakdown
 * sitting directly beneath it — here that is impossible by construction.
 *
 * Returns null when there are too few sources to average honestly.
 */
export function aggregateScore(casino: Casino): number | null {
  const sources = casino.ratings.sources;
  if (sources.length < MIN_RATING_SOURCES) return null;
  const total = sources.reduce((sum, s) => sum + normalise(s.score, s.scale), 0);
  return Math.round((total / sources.length) * 10) / 10;
}

/** Most recent date on which any fact about this casino was checked. */
export function lastVerified(casino: Casino): string | null {
  const dates = [
    ...casino.ratings.sources.map((s) => s.verifiedAt),
    ...(casino.signupBonus ? [casino.signupBonus.verifiedAt] : []),
  ];
  return dates.length ? dates.sort().at(-1)! : null;
}

export function daysSince(isoDate: string, now = new Date()): number {
  const then = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.floor((now.getTime() - then) / 86_400_000);
}

export type ScoreBand = 'high' | 'mid' | 'low';

export function scoreBand(score: number): ScoreBand {
  if (score >= 8) return 'high';
  if (score >= 6.5) return 'mid';
  return 'low';
}

/** Descending by score; casinos without an aggregate sort last, then alphabetically. */
export function byScoreDesc(a: Casino, b: Casino): number {
  const sa = aggregateScore(a);
  const sb = aggregateScore(b);
  if (sa === null && sb === null) return a.name.localeCompare(b.name);
  if (sa === null) return 1;
  if (sb === null) return -1;
  return sb - sa || a.name.localeCompare(b.name);
}
