import redirectMap from './redirect-map.json';

interface Destination {
  url: string;
  affiliate: boolean;
}

interface AnalyticsEngineDataset {
  writeDataPoint(event: {
    blobs?: (string | null)[];
    doubles?: number[];
    indexes?: string[];
  }): void;
}

interface Env {
  /** Optional. Absent in local dev and in preview deploys without the binding. */
  CLICKS?: AnalyticsEngineDataset;
}

interface Context {
  params: Record<string, string | string[]>;
  request: Request;
  env: Env;
}

const destinations = redirectMap as Record<string, Destination>;

/**
 * Outbound redirect for every "Visit site" link.
 *
 * Logging happens here rather than only in GA4 because ad blockers remove a large share
 * of client-side analytics on gambling sites. This count is server-side and therefore the
 * only click figure worth reconciling against affiliate payouts.
 */
export async function onRequestGet(context: Context): Promise<Response> {
  const raw = context.params.slug;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const destination = slug ? destinations[slug] : undefined;

  if (!destination) {
    return new Response('Unknown destination.', {
      status: 404,
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }

  const request = context.request;
  const referer = request.headers.get('referer');
  let refererPath: string | null = null;
  if (referer) {
    try {
      refererPath = new URL(referer).pathname;
    } catch {
      // A malformed Referer is not a reason to fail the redirect.
    }
  }

  context.env.CLICKS?.writeDataPoint({
    indexes: [slug!],
    blobs: [
      slug!,
      refererPath,
      request.headers.get('cf-ipcountry'),
      destination.affiliate ? 'affiliate' : 'direct',
    ],
    doubles: [1],
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination.url,
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'no-store',
    },
  });
}
