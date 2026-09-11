import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testRoot = join(root, 'dist', 'tests');

async function collect(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await collect(path, out);
    else if (entry.isFile() && entry.name.endsWith('.test.js')) out.push(path);
  }
  return out;
}

const files = (await collect(testRoot)).sort();
if (files.length === 0) throw new Error('No compiled test files found under dist/tests');

const child = spawn(process.execPath, ['--test', ...files], {
  cwd: root,
  shell: false,
  stdio: 'inherit'
});
child.on('error', error => { throw error; });
const code = await new Promise(resolveCode => child.on('close', resolveCode));
if (code !== 0) process.exitCode = typeof code === 'number' ? code : 1;
