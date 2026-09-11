import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, extname, resolve } from 'node:path';
import { open } from 'node:fs/promises';
import type { FileNode, FileStatus } from '../../schema/src/index.js';
import { canonicalRepoRelativePath } from './path.js';

async function runGit(cwd: string, args: string[]): Promise<string> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (c: string) => { out += c; });
    child.stderr.on('data', (c: string) => { err += c; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolvePromise(out) : reject(new Error(`git ${args.join(' ')} failed (${code}): ${err.trim()}`)));
  });
}

export async function findRepoRoot(start: string): Promise<string> {
  const out = await runGit(start, ['rev-parse', '--show-toplevel']);
  return resolve(out.trim());
}

function languageFor(path: string): string {
  const ext = extname(path).toLowerCase();
  if (['.ts', '.tsx', '.mts', '.cts'].includes(ext)) return 'typescript';
  if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
  if (ext === '.py') return 'python';
  return 'other';
}

function fileId(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 16);
}

function statusFromLetter(letter: string): FileStatus {
  if (letter === 'A' || letter === '?') return 'added';
  if (letter === 'D') return 'deleted';
  if (letter.startsWith('R')) return 'renamed';
  return 'modified';
}

function parseRanges(diff: string): Map<string, Array<{ start: number; end: number }>> {
  const result = new Map<string, Array<{ start: number; end: number }>>();
  let current: string | null = null;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) current = canonicalRepoRelativePath(line.slice(6));
    else if (line.startsWith('+++ /dev/null')) current = null;
    else if (current && line.startsWith('@@')) {
      const m = /\+(\d+)(?:,(\d+))?/.exec(line);
      if (!m) continue;
      const start = Number(m[1]);
      const count = Number(m[2] ?? '1');
      const ranges = result.get(current) ?? [];
      ranges.push({ start, end: Math.max(start, start + count - 1) });
      result.set(current, ranges);
    }
  }
  return result;
}

async function isSubmodulePath(root: string, path: string): Promise<boolean> {
  try {
    const stage = await runGit(root, ['ls-files', '--stage', '--', path]);
    return stage.split(/\r?\n/).some(line => line.startsWith('160000 '));
  } catch { return false; }
}

async function hasNulByte(root: string, path: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(resolve(root, path), 'r');
    const buffer = Buffer.allocUnsafe(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } catch { return false; }
  finally { await handle?.close().catch(() => undefined); }
}

async function isBinaryChanged(root: string, path: string, base: string, head: string, status: FileStatus): Promise<boolean> {
  const checks = head === 'WORKTREE'
    ? [['diff', '--numstat', '--no-ext-diff', '--', path], ['diff', '--cached', '--numstat', '--no-ext-diff', '--', path]]
    : [['diff', '--numstat', '--no-ext-diff', `${base}..${head}`, '--', path]];
  for (const args of checks) {
    try {
      const output = await runGit(root, args);
      if (output.split(/\r?\n/).some(line => line.startsWith('-\t-\t'))) return true;
    } catch { /* best-effort binary metadata */ }
  }
  return status === 'added' ? hasNulByte(root, path) : false;
}

async function addedFileRange(root: string, path: string): Promise<Array<{ start: number; end: number }> | undefined> {
  let handle;
  try {
    handle = await open(resolve(root, path), 'r');
    const stat = await handle.stat();
    if (stat.size > 8 * 1024 * 1024) return undefined;
    const text = await handle.readFile({ encoding: 'utf8' });
    const lines = text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
    return lines > 0 ? [{ start: 1, end: lines }] : [];
  } catch { return undefined; }
  finally { await handle?.close().catch(() => undefined); }
}

export interface DiffResult {
  root: string;
  base: string;
  head: string;
  files: FileNode[];
}

export async function getDiff(root: string, base = 'HEAD', head = 'WORKTREE'): Promise<DiffResult> {
  const nameArgs = head === 'WORKTREE' ? ['status', '--porcelain=v1', '-z', '--untracked-files=all'] : ['diff', '--name-status', '-M', '-z', `${base}..${head}`];
  const raw = await runGit(root, nameArgs);
  const tokens = raw.split('\0').filter(Boolean);
  const changed = new Map<string, { status: FileStatus; oldPath?: string }>();
  if (head === 'WORKTREE') {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] ?? '';
      const xy = token.slice(0, 2);
      const newPath = canonicalRepoRelativePath(token.slice(3));
      if (!newPath) continue;
      if (xy.includes('R') || xy.includes('C')) {
        const oldPath = canonicalRepoRelativePath(tokens[++i] ?? '');
        changed.set(newPath, { status: 'renamed', ...(oldPath ? { oldPath } : {}) });
      } else {
        const letter = [...xy].find(ch => ch !== ' ') ?? '?';
        changed.set(newPath, { status: statusFromLetter(letter) });
      }
    }
  } else {
    for (let i = 0; i < tokens.length; i++) {
      const status = tokens[i] ?? '';
      if (status.startsWith('R')) {
        const oldPathRaw = tokens[++i];
        const pathRaw = tokens[++i];
        if (oldPathRaw && pathRaw) {
          const oldPath = canonicalRepoRelativePath(oldPathRaw);
          const path = canonicalRepoRelativePath(pathRaw);
          changed.set(path, { status: 'renamed', oldPath });
        }
      } else {
        const pathRaw = tokens[++i];
        if (pathRaw) {
          const path = canonicalRepoRelativePath(pathRaw);
          changed.set(path, { status: statusFromLetter(status) });
        }
      }
    }
  }
  let diffText = '';
  try {
    if (head === 'WORKTREE') {
      const unstaged = await runGit(root, ['diff', '--unified=0', '--no-ext-diff']);
      const staged = await runGit(root, ['diff', '--cached', '--unified=0', '--no-ext-diff']);
      diffText = `${unstaged}\n${staged}`;
    } else {
      diffText = await runGit(root, ['diff', '--unified=0', '--no-ext-diff', `${base}..${head}`]);
    }
  } catch {
    diffText = '';
  }
  const ranges = parseRanges(diffText);
  const files: FileNode[] = [];
  for (const [path, info] of [...changed.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const binary = await isBinaryChanged(root, path, base, head, info.status);
    const submodule = await isSubmodulePath(root, path);
    let changedRanges = ranges.get(path);
    if (!binary && info.status === 'added' && !changedRanges) changedRanges = await addedFileRange(root, path);
    const language = languageFor(path);
    files.push({
      id: fileId(path),
      path,
      language,
      status: info.status,
      ...(info.oldPath ? { oldPath: info.oldPath } : {}),
      ...(changedRanges ? { changedRanges } : {}),
      parseStatus: submodule || language === 'other' ? 'unsupported' : 'ok',
      ...(binary ? { binary: true } : {}),
      ...(submodule ? { submodule: true } : {}),
      generated: /(^|\/)(dist|build|coverage|node_modules)\//.test(path) || /(^|\/)(package-lock|pnpm-lock|yarn\.lock)/.test(path)
    });
  }
  return { root, base, head, files };
}

export function remapRenamedPath(path: string, files: FileNode[]): string {
  let current = path;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const renamed = files.find(file => file.status === 'renamed' && file.oldPath === current);
    if (!renamed) break;
    current = renamed.path;
  }
  return current;
}

export async function gitHead(root: string): Promise<string> {
  return (await runGit(root, ['rev-parse', 'HEAD'])).trim();
}

export async function gitTopLevel(start: string): Promise<string> {
  return findRepoRoot(dirname(resolve(start, '.')));
}
