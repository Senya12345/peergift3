import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

/**
 * Only articles are an Astro content collection. Casinos, factors and currencies are
 * loaded straight from disk by src/lib/content.ts, because the same data has to be
 * readable from astro.config.ts and from the validation scripts — places where
 * `astro:content` does not exist. One loader, one source of truth.
 */
const articles = defineCollection({
  loader: glob({ base: './src/content/articles', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(165),
    /** Must match an author key in src/lib/authors.ts — E-E-A-T needs a real byline. */
    author: z.string(),
    publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    updatedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    /**
     * A factor slug (src/content/factors/) whose casinos render as cards at the bottom of
     * the article — e.g. the no-KYC explainer links out to every no-KYC casino. Explicit
     * rather than inferred from the article's prose, so the list only ever contains
     * casinos actually tagged with that factor, not a guess at what the text is about.
     */
    relatedFactor: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
