#!/usr/bin/env node
/* Test every example and fixture: check.mjs must pass and build.mjs must produce a page.
   node tests/run.mjs        (Node 18+, no packages) */
import { readdirSync, mkdtempSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = join(root, 'skills', 'simulate', 'scripts');
const out = mkdtempSync(join(tmpdir(), 'simlab-'));
const files = ['examples', 'tests/fixtures'].flatMap(d =>
  readdirSync(join(root, d)).filter(f => f.endsWith('.topic.js')).map(f => join(root, d, f)));

let failed = 0;
for (const f of files) {
  const name = f.slice(root.length + 1);
  const check = spawnSync(process.execPath, [join(scripts, 'check.mjs'), f], { encoding: 'utf8' });
  const html = join(out, name.replace(/[\/]/g, '_').replace(/\.topic\.js$/, '.html'));
  const build = check.status === 0 ? spawnSync(process.execPath, [join(scripts, 'build.mjs'), f, '-o', html], { encoding: 'utf8' }) : null;
  const ok = check.status === 0 && build && build.status === 0 && statSync(html).size > 20000;
  console.log((ok ? '✔ ' : '✖ ') + name);
  if (!ok) { failed++; console.log((check.stdout + check.stderr + (build ? build.stdout + build.stderr : '')).replace(/^/gm, '    ')); }
}
console.log(failed ? `\n${failed} of ${files.length} failed` : `\nall ${files.length} topics pass check and build`);
process.exit(failed ? 1 : 0);
