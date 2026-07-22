#!/usr/bin/env node
/* Scaffold a new article: prompts for title/summary/tags, generates the
   slug and today's UTC date, writes src/content/articles/<slug>.md.
   Usage: npm run new            (interactive)
          npm run new -- "Title" (skip the title prompt) */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const articlesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content', 'articles');

// Lowercase, spaces → hyphens, drop anything that isn't a letter/number in
// any script (so CJK titles keep their characters), collapse hyphens.
function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// Quote a scalar only if plain YAML would mangle it.
function yaml(value) {
  return /[:#\[\]{},&*!|>'"%@`]|^\s|\s$/.test(value) ? JSON.stringify(value) : value;
}

const rl = createInterface({ input: stdin, terminal: stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();
// rl.question() drops lines when stdin is piped and pre-buffered; the
// iterator yields them in order for both pipes and interactive use.
const ask = async (q) => {
  if (stdin.isTTY) stdout.write(q);
  const { value } = await lines.next();
  return (value ?? '').trim();
};

const title = argv[2]?.trim() || (await ask('Title: '));
if (!title) {
  console.error('Title is required.');
  process.exit(1);
}
const summary = await ask('Summary (optional): ');
const tagsRaw = await ask('Tags, comma-separated (optional): ');
rl.close();

const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];
// Project default timezone is UTC+8: shift, then take the UTC calendar day.
const date = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

let slug = slugify(title);
if (!slug) slug = date; // title had no letters/numbers at all — fall back to the date
const path = join(articlesDir, `${slug}.md`);
if (existsSync(path)) {
  console.error(`Already exists: ${path}\nEdit it directly, or pick a different title.`);
  process.exit(1);
}

const fm = ['---', `title: ${yaml(title)}`];
if (summary) fm.push(`summary: ${yaml(summary)}`);
fm.push(`date: ${date}`);
if (tags.length) fm.push(`tags: [${tags.map(yaml).join(', ')}]`);
fm.push('draft: false', '---');

writeFileSync(path, `${fm.join('\n')}\n\n`);
console.log(`\nCreated ${path}`);
console.log('Write the body, then: npm run ship');
