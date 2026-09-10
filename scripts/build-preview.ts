import fs from 'node:fs';
import path from 'node:path';

/**
 * Bundles the built site into one self-contained HTML file so it can be published as an
 * artifact and clicked through in a browser.
 *
 * This session runs in a cloud container, so `astro dev` serves a localhost nobody
 * outside the container can reach. The site is small enough (13-16 pages, well under a
 * megabyte) that inlining the whole thing is simpler and more faithful than any tunnel.
 *
 * Reads dist/ only. Nothing about the production build changes.
 */

const dist = path.join(process.cwd(), 'dist');
const outFile = process.argv[2] ?? path.join(process.cwd(), 'preview.html');

if (!fs.existsSync(dist)) {
  console.error('build-preview: dist/ not found. Run `INCLUDE_DEMO=true npm run build` first.');
  process.exit(1);
}

// ---------------------------------------------------------------- collect pages

const pages: { route: string; html: string }[] = [];
const walk = (dir: string): void => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'index.html') {
      const rel = path.relative(dist, path.dirname(full));
      pages.push({ route: rel === '' ? '/' : `/${rel}/`, html: fs.readFileSync(full, 'utf8') });
    }
  }
};
walk(dist);
pages.sort((a, b) => (a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route)));

const between = (html: string, open: RegExp, close: string): string => {
  const start = html.search(open);
  if (start === -1) return '';
  const from = html.indexOf('>', start) + 1;
  const to = html.lastIndexOf(close);
  return to > from ? html.slice(from, to) : '';
};

const titleOf = (html: string): string =>
  (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '').replace(/\s*[—-]\s*Casilla\s*$/, '').trim();

// Header and footer are identical on every page; taking them once also removes the
// duplicate id="main" that concatenating whole documents would produce.
const shellSource = pages.find((p) => p.route === '/')!.html;
const header = between(shellSource, /<header[\s>]/, '</header>');
const footer = between(shellSource, /<footer[\s>]/, '</footer>');

// ---------------------------------------------------------------- rewrite links

const redirectMapPath = path.join(process.cwd(), 'functions/go/redirect-map.json');
const redirects: Record<string, { url: string }> = fs.existsSync(redirectMapPath)
  ? JSON.parse(fs.readFileSync(redirectMapPath, 'utf8'))
  : {};

function rewriteLinks(html: string): string {
  return html.replace(/href="(\/[^"#]*)"/g, (whole, href: string) => {
    // Outbound buttons point at the real destination the Worker would 302 to, so the
    // preview behaves the way production does.
    const go = href.match(/^\/go\/([^/]+)\/?$/);
    if (go) {
      const target = redirects[go[1]!]?.url;
      return target ? `href="${target}"` : whole;
    }
    return `href="#${href}"`;
  });
}

const MIME: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

// Astro's <Image> component (casino logos) emits plain <img src="/_astro/...">
// references that only resolve against a real dist/ server. The artifact is one static
// file with no server behind it, so each one is swapped for its own bytes.
let imagesInlined = 0;
function inlineImages(html: string): string {
  return html.replace(/src="\/_astro\/([^"]+)"/g, (whole, file: string) => {
    const ext = file.split('.').pop()?.toLowerCase() ?? '';
    const mime = MIME[ext];
    const full = path.join(dist, '_astro', file);
    if (!mime || !fs.existsSync(full)) return whole;
    imagesInlined++;
    const data = fs.readFileSync(full).toString('base64');
    return `src="data:${mime};base64,${data}"`;
  });
}

const routes = pages.map((page) => ({
  route: page.route,
  title: titleOf(page.html) || page.route,
  body: inlineImages(rewriteLinks(between(page.html, /<main[\s>]/, '</main>'))),
}));

// ---------------------------------------------------------------- scripts

const scripts = new Set<string>();
for (const page of pages) {
  for (const match of page.html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
    if (match[1]?.trim()) scripts.add(match[1]);
  }
}

// ---------------------------------------------------------------- css and fonts

const cssFile = fs
  .readdirSync(path.join(dist, '_astro'))
  .find((f) => f.endsWith('.css'))!;
let css = fs.readFileSync(path.join(dist, '_astro', cssFile), 'utf8');

// Artifacts may not fetch fonts from anywhere, so keep only the latin subsets and embed
// them. 64 KB of woff2 buys exact typography with zero external requests.
let kept = 0;
css = css.replace(/@font-face\{[^}]*\}/g, (rule) => {
  const src = rule.match(/url\(\/_astro\/([^)]+)\)/)?.[1];
  if (!src || !/-latin-wght-/.test(src)) return '';
  const data = fs.readFileSync(path.join(dist, '_astro', src)).toString('base64');
  kept++;
  return rule.replace(/url\([^)]+\)/, `url(data:font/woff2;base64,${data})`);
});

// ---------------------------------------------------------------- emit

const nav = routes
  .map((r) => `<a href="#${r.route}" data-nav="${r.route}">${r.title || r.route}</a>`)
  .join('');

const sections = routes
  .map((r) => `<div data-route="${r.route}" hidden><main class="flex-1 w-full max-w-[1120px] mx-auto px-4 py-10">${r.body}</main></div>`)
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Casilla</title>
<style>${css}</style>
<style>
#preview-bar{position:sticky;top:0;z-index:50;display:flex;gap:2px;overflow-x:auto;
  padding:6px 8px;background:#000;border-bottom:1px solid var(--color-ink-600);
  font-family:var(--font-body);font-size:12px;white-space:nowrap}
#preview-bar a{color:var(--color-ink-300);text-decoration:none;padding:4px 8px;border-radius:3px;flex:0 0 auto}
#preview-bar a:hover{color:var(--color-ink-050);background:var(--color-ink-700)}
#preview-bar a[aria-current="page"]{color:var(--color-ink-900);background:var(--color-amber-500);font-weight:600}
#preview-note{padding:6px 12px;background:var(--color-amber-950);color:var(--color-amber-400);
  font-family:var(--font-body);font-size:12.5px;border-bottom:1px solid var(--color-ink-600)}
</style>
</head>
<body class="min-h-screen flex flex-col" data-page-type="home">
<nav id="preview-bar">${nav}</nav>
<p id="preview-note">Preview build. Casino records are clearly-labelled placeholders with invented figures — no real operator data.</p>
${header ? `<header class="border-b border-ink-600 bg-ink-800">${header}</header>` : ''}
${sections}
${footer ? `<footer class="border-t border-ink-600 bg-ink-800 mt-16">${footer}</footer>` : ''}

<script>
(function () {
  var sections = [].slice.call(document.querySelectorAll('[data-route]'));
  var links = [].slice.call(document.querySelectorAll('#preview-bar a'));
  function show(route) {
    var found = false;
    sections.forEach(function (s) {
      var match = s.getAttribute('data-route') === route;
      s.hidden = !match;
      if (match) found = true;
    });
    if (!found) { sections[0].hidden = false; route = sections[0].getAttribute('data-route'); }
    links.forEach(function (a) {
      if (a.getAttribute('data-nav') === route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  function current() {
    var h = location.hash.replace(/^#/, '');
    return h && h.charAt(0) === '/' ? h : '/';
  }
  window.addEventListener('hashchange', function () { show(current()); });
  show(current());
})();
</script>
${[...scripts].map((s) => `<script type="module">${s}</script>`).join('\n')}
</body>
</html>
`;

fs.writeFileSync(outFile, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(
  `build-preview: ${routes.length} routes, ${scripts.size} script block(s), ` +
    `${kept} embedded font face(s), ${imagesInlined} embedded image(s) -> ${outFile} (${kb} KB)`,
);
