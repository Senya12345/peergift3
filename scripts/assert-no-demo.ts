import fs from 'node:fs';
import path from 'node:path';

/**
 * Fails if any placeholder casino reached the build.
 *
 * Deliberately structural rather than a text search: the word "placeholder" legitimately
 * appears in the search input's HTML attribute and in Tailwind's placeholder: utility, so
 * grepping for it reports a leak on every clean build. What actually matters is whether a
 * record marked `demo: true` produced a page or is named anywhere in the output.
 */
const contentDir = path.join(process.cwd(), 'src/content/casinos');
const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  console.error('assert-no-demo: dist/ not found — run the build first.');
  process.exit(1);
}

const demoSlugs = fs
  .readdirSync(contentDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(contentDir, f), 'utf8')) as Record<string, unknown>)
  .filter((record) => record.demo === true)
  .map((record) => String(record.slug));

if (demoSlugs.length === 0) {
  console.log('assert-no-demo: no demo records exist; nothing to check.');
  process.exit(0);
}

const htmlFiles: string[] = [];
const walk = (dir: string): void => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html') || entry.name.endsWith('.txt')) htmlFiles.push(full);
  }
};
walk(distDir);

const leaks: string[] = [];

for (const slug of demoSlugs) {
  const page = path.join(distDir, 'casinos', slug, 'index.html');
  if (fs.existsSync(page)) leaks.push(`page generated for demo record: ${page}`);

  for (const file of htmlFiles) {
    if (fs.readFileSync(file, 'utf8').includes(slug)) {
      leaks.push(`"${slug}" referenced in ${path.relative(process.cwd(), file)}`);
    }
  }
}

if (leaks.length) {
  console.error('assert-no-demo: placeholder data reached the build.');
  for (const leak of leaks) console.error(`  ${leak}`);
  console.error('\nINCLUDE_DEMO must be false for any build that ships.');
  process.exit(1);
}

console.log(
  `assert-no-demo: OK — none of the ${demoSlugs.length} demo record(s) reached dist/.`,
);
