import { realpath, lstat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export interface PathContext {
  root: string;
  sessionCwd: string;
  caseInsensitive: boolean;
}

function slash(value: string): string {
  return value.replaceAll('\\', '/');
}

export function canonicalRepoRelativePath(value: string): string {
  const normalized = slash(value).replace(/^\.\//, '');
  return process.platform === 'win32' || process.platform === 'darwin' ? normalized.toLowerCase() : normalized;
}

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

export async function createPathContext(root: string, sessionCwd = root): Promise<PathContext> {
  const canonicalRoot = await realpath(root);
  const canonicalCwd = isAbsolute(sessionCwd) ? resolve(sessionCwd) : resolve(canonicalRoot, sessionCwd);
  if (!inside(canonicalRoot, canonicalCwd)) throw new Error(`PATH001: session cwd escapes repository root: ${sessionCwd}`);
  return { root: canonicalRoot, sessionCwd: canonicalCwd, caseInsensitive: process.platform === 'win32' || process.platform === 'darwin' };
}

export function normalizeRepoPath(ctx: PathContext, rawPath: string): string {
  const anchored = isAbsolute(rawPath) ? resolve(rawPath) : resolve(ctx.sessionCwd, rawPath);
  if (!inside(ctx.root, anchored)) throw new Error(`PATH001: evidence path escaped allowed root: ${rawPath}`);
  let rel = slash(relative(ctx.root, anchored));
  if (rel === '') rel = '.';
  return ctx.caseInsensitive ? canonicalRepoRelativePath(rel) : rel;
}

export async function assertNoExternalSymlink(ctx: PathContext, rawPath: string): Promise<void> {
  const anchored = isAbsolute(rawPath) ? resolve(rawPath) : resolve(ctx.root, rawPath);
  const stat = await lstat(anchored).catch(() => null);
  if (!stat?.isSymbolicLink()) return;
  const target = await realpath(anchored);
  if (!inside(ctx.root, target)) throw new Error(`PATH001: symlink escapes repository root: ${rawPath}`);
}

export function displayPath(ctx: PathContext, canonicalPath: string): string {
  return canonicalPath === '.' ? '.' : canonicalPath.split('/').join(sep);
}
