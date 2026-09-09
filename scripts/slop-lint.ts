import fs from 'node:fs';
import path from 'node:path';
import { loadCasinos, loadCurrencies, loadFactors } from '../src/lib/content';

/**
 * Guards the prose against the two failure modes that matter here.
 *
 * Google runs no "was this written by AI?" detector; what the March 2026 core update
 * punished was scaled content abuse — templated pages produced at volume. A facet-driven
 * site is exactly that shape, so the defence is measurable: banned filler must be absent,
 * pages must be substantial, and any two generated pages must differ in most of their
 * words. Thresholds follow the seo-programmatic quality gates.
 */

const BANNED = [
  'delve into',
  "it's important to note",
  'it is important to note',
  "in today's fast-paced world",
  'ever-evolving landscape',
  "it's no secret that",
  'when it comes to',
  'look no further',
  'unlock the potential',
  'game-changer',
  'seamless',
  'robust',
  'elevate your',
  'navigate the world of',
  'in conclusion',
  'that being said',
  'a testament to',
];

const MIN_WORDS = 300;
const UNIQUENESS_WARN = 0.4;
const UNIQUENESS_FAIL = 0.3;

const errors: string[] = [];
const warnings: string[] = [];

interface Doc {
  label: string;
  text: string;
  /** Only generated pages take part in the uniqueness comparison. */
  programmatic: boolean;
  /** Only indexable pages must clear the word-count floor. */
  enforceLength: boolean;
}

const docs: Doc[] = [];

for (const factor of loadFactors()) {
  docs.push({
    label: `factor/${factor.slug}`,
    text: [factor.intro, ...factor.faq.flatMap((f) => [f.q, f.a])].join('\n\n'),
    programmatic: true,
    enforceLength: true,
  });
}

for (const currency of loadCurrencies()) {
  docs.push({
    label: `currency/${currency.code}`,
    text: [currency.intro, ...currency.faq.flatMap((f) => [f.q, f.a])].join('\n\n'),
    programmatic: true,
    enforceLength: true,
  });
}

for (const casino of loadCasinos()) {
  const aiSummaryText = casino.aiSummary
    ? [casino.aiSummary.withdrawals, casino.aiSummary.deposits, casino.aiSummary.commonProblems]
    : [];
  docs.push({
    label: `casino/${casino.slug}`,
    text: [
      casino.editorial.summary,
      ...casino.editorial.pros,
      ...casino.editorial.cons,
      ...aiSummaryText,
    ].join('\n\n'),
    programmatic: true,
    // Placeholder records exist to exercise templates, not to be read.
    enforceLength: !casino.demo,
  });
}

const articleDir = path.join(process.cwd(), 'src/content/articles');
if (fs.existsSync(articleDir)) {
  for (const file of fs.readdirSync(articleDir).filter((f) => f.endsWith('.mdx'))) {
    const raw = fs.readFileSync(path.join(articleDir, file), 'utf8');
    docs.push({
      label: `article/${file}`,
      text: raw.replace(/^---[\s\S]*?---/, ''),
      // Articles are written individually, so they are not part of the template set.
      programmatic: false,
      enforceLength: true,
    });
  }
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

for (const doc of docs) {
  const lower = doc.text.toLowerCase();
  for (const phrase of BANNED) {
    if (lower.includes(phrase.toLowerCase())) {
      errors.push(`${doc.label}: banned phrase "${phrase}"`);
    }
  }

  const count = words(doc.text).length;
  if (doc.enforceLength && count < MIN_WORDS) {
    warnings.push(`${doc.label}: ${count} words, below the ${MIN_WORDS}-word floor for an indexed page`);
  }
}

/**
 * Jaccard similarity over the word sets of every pair of generated pages. Catches the
 * mad-libs failure — the same paragraph with the subject swapped — which is the single
 * clearest scaled-content signal and impossible to spot by eye across dozens of files.
 */
// Only texts long enough for the metric to mean anything. Over a couple of dozen words,
// each differing token moves the score so far that near-identical stubs score as highly
// unique — comparing them would produce noise, not signal.
const MIN_WORDS_FOR_COMPARISON = 150;
const programmatic = docs.filter(
  (d) => d.programmatic && words(d.text).length >= MIN_WORDS_FOR_COMPARISON,
);
for (let i = 0; i < programmatic.length; i++) {
  for (let j = i + 1; j < programmatic.length; j++) {
    const a = new Set(words(programmatic[i]!.text));
    const b = new Set(words(programmatic[j]!.text));
    const shared = [...a].filter((w) => b.has(w)).length;
    const union = new Set([...a, ...b]).size;
    const unique = 1 - shared / union;

    const pair = `${programmatic[i]!.label} vs ${programmatic[j]!.label}`;
    if (unique < UNIQUENESS_FAIL) {
      errors.push(`${pair}: only ${(unique * 100).toFixed(0)}% unique — rewrite one of them`);
    } else if (unique < UNIQUENESS_WARN) {
      warnings.push(`${pair}: ${(unique * 100).toFixed(0)}% unique, below the 40% target`);
    }
  }
}

console.log(`slop-lint: checked ${docs.length} documents`);
for (const warning of warnings) console.warn(`  warn  ${warning}`);
for (const error of errors) console.error(`  ERROR ${error}`);

if (errors.length) {
  console.error(`\nslop-lint failed with ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`slop-lint: OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
