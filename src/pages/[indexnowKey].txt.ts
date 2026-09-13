import type { APIRoute, GetStaticPaths } from 'astro';

/**
 * IndexNow ownership proof: the protocol requires a file at /{key}.txt whose only
 * content is the key itself. Serving it from a route rather than committing a static
 * file keeps the key in the environment alongside SITE_URL, so rotating it is an env
 * change and a rebuild rather than a commit that publishes the key to the repo.
 *
 * No key set means no route, which is the correct behaviour for a build that isn't
 * submitting anything — an empty or placeholder key file would fail verification and
 * mark the whole host as untrusted with the endpoint.
 */
const key = process.env.INDEXNOW_KEY ?? '';

export const getStaticPaths: GetStaticPaths = () =>
  key ? [{ params: { indexnowKey: key } }] : [];

export const GET: APIRoute = () =>
  new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
