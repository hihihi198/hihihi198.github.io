#!/usr/bin/env node
/* Ship article changes: build, then commit + push ONLY src/content/articles
   (other working-tree changes are left alone). Usage: npm run ship */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

const DIR = 'src/content/articles';

// 1. Anything to ship? (-z: NUL-separated, no quoting of non-ASCII paths)
const raw = execFileSync('git', ['status', '--porcelain', '-z', '--', DIR], { encoding: 'utf8' });
const entries = raw.split('\0').filter((e) => /^[MADRCU?! ]{2} ./.test(e));
if (!entries.length) {
  console.log(`No changes in ${DIR} — nothing to ship.`);
  process.exit(0);
}

// 2. Build first; abort on failure so a broken post never reaches CI.
run('npm', ['run', 'build']);

// 3. Describe the changes for the commit message.
const titleOf = (path) => {
  try {
    const m = readFileSync(path, 'utf8').match(/^title:\s*["']?(.+?)["']?\s*$/m);
    return m?.[1];
  } catch {
    return undefined;
  }
};
const changes = entries.map((entry) => {
  const xy = entry.slice(0, 2);
  const path = entry.slice(3);
  const name = titleOf(path) ?? path.split('/').pop().replace(/\.md$/, '');
  if (xy.includes('D')) return `Remove article: ${name}`;
  if (xy.includes('A') || xy.includes('?')) return `Add article: ${name}`;
  return `Update article: ${name}`;
});
const [summary, ...rest] = [...new Set(changes)];
const commitArgs = ['commit', '-m', summary];
for (const line of rest) commitArgs.push('-m', line);

// 4. Commit articles only, then push (Actions deploys on push to main).
run('git', ['add', '--', DIR]);
run('git', commitArgs);
run('git', ['push']);
console.log('\nShipped. Deploy finishes in about a minute:');
console.log('  gh run watch --repo hihihi198/hihihi198.github.io');
