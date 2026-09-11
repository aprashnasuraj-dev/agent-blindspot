import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { PathContext } from '../../git/src/path.js';
import { normalizeRepoPath } from '../../git/src/path.js';
import type { Diagnostic } from '../../schema/src/index.js';

export interface CoverageLoadResult { covered: Set<string>; diagnostics: Diagnostic[]; }

function safeMapPath(ctx: PathContext, path: string, diagnostics: Diagnostic[]): string | null {
  try { return normalizeRepoPath(ctx, path); }
  catch {
    diagnostics.push({ code: 'COV001', severity: 'warning', subsystem: 'coverage', message: `Coverage path did not map to repository: ${path}` });
    return null;
  }
}

export async function loadCoverage(path: string, ctx: PathContext): Promise<CoverageLoadResult> {
  const text = await readFile(path, 'utf8');
  const diagnostics: Diagnostic[] = [];
  const covered = new Set<string>();
  if (extname(path).toLowerCase() === '.info' || /^SF:/m.test(text)) {
    for (const line of text.split(/\r?\n/)) if (line.startsWith('SF:')) {
      const mapped = safeMapPath(ctx, line.slice(3).trim(), diagnostics);
      if (mapped) covered.add(mapped);
    }
    return { covered, diagnostics };
  }
  const data = JSON.parse(text) as unknown;
  if (!data || typeof data !== 'object') return { covered, diagnostics };
  const obj = data as Record<string, unknown>;
  if (obj.files && typeof obj.files === 'object') {
    for (const file of Object.keys(obj.files as object)) {
      const mapped = safeMapPath(ctx, file, diagnostics);
      if (mapped) covered.add(mapped);
    }
    return { covered, diagnostics };
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && ('path' in (value as object) || 'statementMap' in (value as object))) {
      const p = typeof (value as Record<string, unknown>).path === 'string' ? String((value as Record<string, unknown>).path) : key;
      const mapped = safeMapPath(ctx, p, diagnostics);
      if (mapped) covered.add(mapped);
    }
  }
  return { covered, diagnostics };
}
