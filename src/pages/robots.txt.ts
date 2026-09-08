import type { APIRoute } from 'astro';
import { siteIndexable } from '../lib/content';
import { SITE } from '../lib/site';

export const GET: APIRoute = () => {
  // While the site is gated, say so at the door rather than relying on per-page meta.
  const body = siteIndexable
    ? [
        'User-agent: *',
        'Allow: /',
        // Affiliate redirects are for humans, not crawlers.
        'Disallow: /go/',
        '',
        `Sitemap: ${SITE.url}/sitemap-index.xml`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
