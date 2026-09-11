import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const roots = ['apps', 'packages'];
const findings = [];

async function walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p);
    else if (extname(entry.name) === '.ts') {
      const text = await readFile(p, 'utf8');
      const banned = [
        [/\beval\s*\(/g, 'eval is forbidden'],
        [/\.innerHTML\s*=/g, 'innerHTML assignment is forbidden'],
        [/(?:^|[^.\w])execSync\s*\(/gm, 'child-process execSync is forbidden; use argv-based spawn'],
        [/(?:^|[^.\w])exec\s*\(/gm, 'child-process exec is forbidden; use argv-based spawn'],
        [/import\s*\{[^}]*\bexec(?:Sync)?\b[^}]*\}\s*from\s*['"]node:child_process['"]/g, 'child-process exec import is forbidden; use argv-based spawn']
      ];
      for (const [rx, msg] of banned) {
        if (rx.test(text)) findings.push(`${p}: ${msg}`);
      }
    }
  }
}

for (const root of roots) await walk(root);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exit(1);
}
console.log('security-lint: OK');
