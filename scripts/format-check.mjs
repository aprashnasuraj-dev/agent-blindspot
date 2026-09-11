import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const roots = ['apps', 'packages', 'tests', 'scripts', 'benchmarks', 'docs'];
const exts = new Set(['.ts', '.mjs', '.md', '.json', '.yml', '.yaml']);
const failures = [];
async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p);
    else if (exts.has(extname(entry.name))) {
      const text = await readFile(p, 'utf8');
      if (!text.endsWith('\n')) failures.push(`${p}: missing final newline`);
      text.split('\n').forEach((line, i) => {
        if (/[ \t]+$/.test(line)) failures.push(`${p}:${i + 1}: trailing whitespace`);
      });
    }
  }
}
for (const root of roots) await walk(root);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('format-check: OK');
