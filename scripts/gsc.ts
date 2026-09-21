import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Pulls Search Console performance data straight from the API.
 *
 * The seo-google skill documents this API but ships no runnable code — it assumes a
 * `claude-seo` CLI and the Python Google client libraries, neither of which is installed
 * here. Signing a service-account JWT and trading it for an access token is about thirty
 * lines against node:crypto, so this depends on nothing at all and works anywhere Node
 * runs, including the deploy box.
 *
 * The credential is a file path in GSC_SERVICE_ACCOUNT, never a repository file: it is a
 * private key, and the only thing standing between it and the repo is that rule.
 *
 * Usage:
 *   GSC_SERVICE_ACCOUNT=/path/to/key.json npx tsx scripts/gsc.ts queries
 *   GSC_SERVICE_ACCOUNT=... npx tsx scripts/gsc.ts pages --days 28
 *   GSC_SERVICE_ACCOUNT=... npx tsx scripts/gsc.ts queries --csv out.csv
 */
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = b64url(
    crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), sa.private_key),
  );

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(
      `token exchange failed (${res.status}): ${body.error ?? ''} ${body.error_description ?? ''}`.trim(),
    );
  }
  return body.access_token;
}

interface Row {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

async function query(
  token: string,
  property: string,
  dimensions: string[],
  startDate: string,
  endDate: string,
): Promise<Row[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    property,
  )}/searchAnalytics/query`;

  const rows: Row[] = [];
  // The API caps a page at 25 000 rows; a young site is nowhere near that, but paging
  // costs nothing and removes a silent truncation from the picture later on.
  for (let startRow = 0; ; startRow += 25000) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, dimensions, rowLimit: 25000, startRow }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`searchAnalytics ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as { rows?: Row[] };
    if (!page.rows?.length) break;
    rows.push(...page.rows);
    if (page.rows.length < 25000) break;
  }
  return rows;
}

/**
 * A property can be verified either as a domain property or as a URL prefix, and the API
 * needs whichever one actually exists — the wrong guess is a bare 403 that reads like a
 * permissions problem. So ask which properties this credential can see and match.
 */
async function resolveProperty(token: string, domain: string): Promise<string> {
  const res = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`sites.list ${res.status}: ${await res.text()}`);
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: { siteUrl: string }[] };

  if (siteEntry.length === 0) {
    throw new Error(
      'the service account can see no properties — add its client_email under ' +
        'Search Console > Settings > Users and permissions',
    );
  }

  const match = siteEntry.find((s) => s.siteUrl.includes(domain));
  if (!match) {
    throw new Error(
      `no property matching ${domain}. Visible to this credential: ${siteEntry
        .map((s) => s.siteUrl)
        .join(', ')}`,
    );
  }
  return match.siteUrl;
}

const args = process.argv.slice(2);
const mode = args[0] ?? 'queries';
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const keyPath = process.env.GSC_SERVICE_ACCOUNT;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('gsc: set GSC_SERVICE_ACCOUNT to the path of the service account JSON key.');
  process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as ServiceAccount;
const domain = flag('domain') ?? 'gambleatlas.com';
const days = Number(flag('days') ?? 90);

// GSC data lags by two to three days; asking for today returns an empty tail that reads
// like a traffic collapse.
const end = new Date(Date.now() - 3 * 86_400_000);
const start = new Date(end.getTime() - days * 86_400_000);
const iso = (d: Date): string => d.toISOString().slice(0, 10);

const token = await accessToken(sa);
const property = flag('property') ?? (await resolveProperty(token, domain));
console.log(`gsc: ${property}, ${iso(start)} to ${iso(end)}\n`);

const dimensions = mode === 'pages' ? ['page'] : mode === 'both' ? ['page', 'query'] : ['query'];
const rows = await query(token, property, dimensions, iso(start), iso(end));

if (rows.length === 0) {
  console.log('no rows — either no impressions in this window, or the property is wrong.');
  process.exit(0);
}

const totals = rows.reduce(
  (acc, r) => ({ clicks: acc.clicks + r.clicks, impressions: acc.impressions + r.impressions }),
  { clicks: 0, impressions: 0 },
);
console.log(
  `${rows.length} rows | ${totals.clicks} clicks | ${totals.impressions} impressions | ` +
    `CTR ${((totals.clicks / totals.impressions) * 100).toFixed(2)}%\n`,
);

const sorted = [...rows].sort((a, b) => b.impressions - a.impressions);
console.log(
  ['clicks', 'impr', 'ctr%', 'pos', dimensions.join(' / ')]
    .map((h, i) => (i < 4 ? h.padStart(7) : `  ${h}`))
    .join(''),
);
for (const r of sorted.slice(0, 50)) {
  console.log(
    String(r.clicks).padStart(7) +
      String(r.impressions).padStart(7) +
      (r.ctr * 100).toFixed(1).padStart(7) +
      r.position.toFixed(1).padStart(7) +
      `  ${r.keys.join(' / ')}`,
  );
}

const csv = flag('csv');
if (csv) {
  const esc = (s: string): string => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    [...dimensions, 'clicks', 'impressions', 'ctr', 'position'].join(','),
    ...sorted.map((r) =>
      [...r.keys.map(esc), r.clicks, r.impressions, r.ctr.toFixed(4), r.position.toFixed(1)].join(','),
    ),
  ];
  fs.mkdirSync(path.dirname(path.resolve(csv)), { recursive: true });
  fs.writeFileSync(csv, lines.join('\n'));
  console.log(`\nwrote ${sorted.length} rows to ${csv}`);
}
