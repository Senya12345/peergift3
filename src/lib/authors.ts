import { SITE } from './site';

export interface Author {
  key: string;
  name: string;
  role: string;
  bio: string;
  /** Only set this once there is a real profile to point at. */
  sameAs?: string[];
}

/**
 * Article bylines.
 *
 * A named human with a verifiable history is a stronger E-E-A-T signal than a house
 * byline, and in a YMYL niche that gap is worth closing. It is deliberately not closed
 * with an invented person: a fabricated author with a fabricated biography is exactly the
 * kind of fake authority signal that gets a gambling site demoted, and it would make
 * every honesty claim elsewhere on this site worthless. Add a real person here when there
 * is one to add.
 */
export const AUTHORS: Record<string, Author> = {
  editorial: {
    key: 'editorial',
    name: 'Gamble Atlas editorial',
    role: 'Editorial team',
    bio: 'The people who check the figures on this site. Every rating is read from the source platform and dated, every casino page carries genuine criticism, and no operator can pay for placement.',
  },
};

export function getAuthor(key: string): Author {
  const author = AUTHORS[key];
  if (!author) {
    throw new Error(
      `Unknown author "${key}". Add them to src/lib/authors.ts before publishing.`,
    );
  }
  return author;
}

export function authorSchema(author: Author): Record<string, unknown> {
  return {
    '@type': author.key === 'editorial' ? 'Organization' : 'Person',
    name: author.name,
    description: author.bio,
    url: `${SITE.url}/about/`,
    ...(author.sameAs ? { sameAs: author.sameAs } : {}),
  };
}
