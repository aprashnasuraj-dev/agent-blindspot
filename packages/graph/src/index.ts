import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, posix, relative, resolve } from 'node:path';
import type { DependencyEdge, Diagnostic } from '../../schema/src/index.js';
import { canonicalRepoRelativePath } from '../../git/src/path.js';

export interface GraphResult {
  files: string[];
  edges: DependencyEdge[];
  reverse: Map<string, DependencyEdge[]>;
  limitations: string[];
  diagnostics: Diagnostic[];
}

const SOURCE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.py'];
const EXCLUDED = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.venv', 'venv', '__pycache__']);

async function walk(root: string, dir = root, out: string[] = [], symlinks: string[] = []): Promise<{ files: string[]; symlinks: string[] }> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      symlinks.push(canonicalRepoRelativePath(relative(root, full)));
      continue;
    }
    if (entry.isDirectory()) await walk(root, full, out, symlinks);
    else if (SOURCE_EXTS.includes(extname(entry.name))) out.push(canonicalRepoRelativePath(relative(root, full)));
  }
  return { files: out, symlinks };
}

async function exists(path: string): Promise<boolean> {
  return await stat(path).then(() => true).catch(() => false);
}

interface JsResolverContext {
  baseUrl: string;
  paths: Array<{ key: string; targets: string[] }>;
  workspaces: Map<string, { dir: string; entry?: string }>;
  virtualFiles: Set<string>;
}

function parseJsonc(text: string): unknown {
  let out = '';
  let inString = false;
  let quote = '';
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? '';
    const next = text[i + 1] ?? '';
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; quote = ch; out += ch; continue; }
    if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += ch;
  }
  out = out.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(out);
}

async function readJsoncObject(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = parseJsonc(await readFile(path, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

async function resolveJsAt(root: string, base: string, confidence: number, virtualFiles = new Set<string>()): Promise<{ path?: string; confidence: number; ambiguous?: boolean }> {
  const emittedJsReplacement = /\.(?:mjs|cjs|js|jsx)$/.test(base) ? base.replace(/\.(?:mjs|cjs|js|jsx)$/, '') : null;
  const candidates = [
    base,
    ...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'].map(e => base + e),
    ...(emittedJsReplacement ? ['.ts', '.tsx', '.mts', '.cts'].map(e => emittedJsReplacement + e) : []),
    ...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'].map(e => join(base, 'index' + e))
  ];
  const hits: string[] = [];
  for (const candidate of candidates) {
    const rel = canonicalRepoRelativePath(relative(root, candidate));
    if (virtualFiles.has(rel) || await exists(candidate)) hits.push(rel);
  }
  const unique = [...new Set(hits)];
  if (unique.length === 1) return { path: unique[0]!, confidence };
  if (unique.length > 1) return { path: unique.sort()[0]!, confidence: Math.min(0.5, confidence), ambiguous: true };
  return { confidence: 0 };
}

function aliasCapture(key: string, specifier: string): string | undefined {
  const star = key.indexOf('*');
  if (star < 0) return key === specifier ? '' : undefined;
  const prefix = key.slice(0, star);
  const suffix = key.slice(star + 1);
  if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) return undefined;
  return specifier.slice(prefix.length, specifier.length - suffix.length);
}

async function loadJsResolverContext(root: string, virtualFiles = new Set<string>()): Promise<JsResolverContext> {
  const tsconfig = await readJsoncObject(join(root, 'tsconfig.json'));
  const compilerOptions = tsconfig?.compilerOptions && typeof tsconfig.compilerOptions === 'object' ? tsconfig.compilerOptions as Record<string, unknown> : {};
  const baseUrl = resolve(root, typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : '.');
  const pathsObj = compilerOptions.paths && typeof compilerOptions.paths === 'object' ? compilerOptions.paths as Record<string, unknown> : {};
  const paths = Object.entries(pathsObj).flatMap(([key, value]) => Array.isArray(value) && value.every(v => typeof v === 'string') ? [{ key, targets: value as string[] }] : []).sort((a, b) => a.key.localeCompare(b.key));
  const workspaces = new Map<string, { dir: string; entry?: string }>();
  const rootPackage = await readJsoncObject(join(root, 'package.json'));
  const workspaceValue = rootPackage?.workspaces;
  let rawWorkspaces: unknown[] = [];
  if (Array.isArray(workspaceValue)) rawWorkspaces = workspaceValue;
  else if (workspaceValue && typeof workspaceValue === 'object') {
    const packages = (workspaceValue as Record<string, unknown>).packages;
    if (Array.isArray(packages)) rawWorkspaces = packages;
  }
  const workspaceDirs = new Set<string>();
  for (const patternValue of rawWorkspaces) {
    if (typeof patternValue !== 'string') continue;
    const pattern = patternValue.replaceAll('\\', '/').replace(/\/$/, '');
    if (!pattern.includes('*')) { workspaceDirs.add(pattern); continue; }
    if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) continue;
    const parent = resolve(root, pattern.slice(0, -2));
    try {
      for (const entry of await readdir(parent, { withFileTypes: true })) if (entry.isDirectory()) workspaceDirs.add(canonicalRepoRelativePath(relative(root, join(parent, entry.name))));
    } catch { /* absent workspace parent */ }
  }
  for (const dir of [...workspaceDirs].sort()) {
    const pkg = await readJsoncObject(resolve(root, dir, 'package.json'));
    if (!pkg || typeof pkg.name !== 'string') continue;
    const entryValues = [pkg.source, pkg.module, pkg.main, pkg.types].filter((v): v is string => typeof v === 'string');
    let entry: string | undefined;
    for (const candidate of [...entryValues, 'src/index.ts', 'src/index.tsx', 'index.ts', 'index.js']) {
      const resolved = await resolveJsAt(root, resolve(root, dir, candidate), 0.95, virtualFiles);
      if (resolved.path) { entry = resolved.path; break; }
    }
    workspaces.set(pkg.name, { dir, ...(entry ? { entry } : {}) });
  }
  return { baseUrl, paths, workspaces, virtualFiles };
}

async function resolveJs(root: string, importer: string, specifier: string, ctx: JsResolverContext): Promise<{ path?: string; confidence: number; ambiguous?: boolean }> {
  if (specifier.startsWith('.')) return resolveJsAt(root, resolve(root, dirname(importer), specifier), 1, ctx.virtualFiles);
  for (const mapping of ctx.paths) {
    const captured = aliasCapture(mapping.key, specifier);
    if (captured === undefined) continue;
    const hits: Array<{ path: string; confidence: number }> = [];
    for (const target of mapping.targets) {
      const targetPath = target.includes('*') ? target.replace('*', captured) : target;
      const resolved = await resolveJsAt(root, resolve(ctx.baseUrl, targetPath), 0.95, ctx.virtualFiles);
      if (resolved.path) hits.push({ path: resolved.path, confidence: resolved.confidence });
    }
    const unique = [...new Map(hits.map(hit => [hit.path, hit])).values()].sort((a, b) => a.path.localeCompare(b.path));
    if (unique.length === 1) return unique[0]!;
    if (unique.length > 1) return { path: unique[0]!.path, confidence: 0.5, ambiguous: true };
    return { confidence: 0 };
  }
  for (const [name, workspace] of [...ctx.workspaces.entries()].sort(([a], [b]) => b.length - a.length || a.localeCompare(b))) {
    if (specifier !== name && !specifier.startsWith(`${name}/`)) continue;
    if (specifier === name && workspace.entry) return { path: workspace.entry, confidence: 0.95 };
    const subpath = specifier === name ? '' : specifier.slice(name.length + 1);
    return resolveJsAt(root, resolve(root, workspace.dir, subpath), 0.95, ctx.virtualFiles);
  }
  return { confidence: 0 };
}

function pythonModuleCandidates(importer: string, moduleName: string, level: number): string[] {
  const importerDir = posix.dirname(importer);
  let base = importerDir;
  for (let i = 1; i < level; i++) base = posix.dirname(base);
  const relModule = moduleName.split('.').filter(Boolean).join('/');
  const prefix = level > 0 ? base : '';
  const joined = [prefix, relModule].filter(Boolean).join('/');
  return [`${joined}.py`, `${joined}/__init__.py`].map(s => s.replace(/^\//, ''));
}

async function resolvePython(root: string, importer: string, moduleName: string, level: number, virtualFiles = new Set<string>()): Promise<{ path?: string; confidence: number; ambiguous?: boolean }> {
  const candidates = pythonModuleCandidates(importer, moduleName, level);
  const sourceRootCandidates = level > 0 ? candidates : [...candidates, ...candidates.map(c => `src/${c}`)];
  const hits: string[] = [];
  for (const relPath of sourceRootCandidates) if (virtualFiles.has(relPath) || await exists(resolve(root, relPath))) hits.push(relPath);
  const unique = [...new Set(hits)];
  if (unique.length === 1) return { path: unique[0]!, confidence: 0.95 };
  if (unique.length > 1) return { path: unique[0]!, confidence: 0.5, ambiguous: true };
  return { confidence: 0 };
}

export async function buildGraph(root: string, options: { virtualFiles?: Iterable<string> } = {}): Promise<GraphResult> {
  const virtualFiles = new Set([...(options.virtualFiles ?? [])].map(canonicalRepoRelativePath));
  const jsResolver = await loadJsResolverContext(root, virtualFiles);
  const walked = await walk(root);
  const files = walked.files.sort();
  const edges: DependencyEdge[] = [];
  const diagnostics: Diagnostic[] = [];
  const limitations: string[] = walked.symlinks.sort().map(path => `Symlink excluded from source graph: ${path}`);
  for (const file of files) {
    const text = await readFile(resolve(root, file), 'utf8');
    const ext = extname(file);
    const lines = text.split(/\r?\n/);
    if (ext === '.py') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        let match = /^\s*from\s+(\.*)([A-Za-z_][\w.]*)?\s+import\s+/.exec(line);
        if (match) {
          const level = (match[1] ?? '').length;
          const moduleName = match[2] ?? '';
          const resolved = await resolvePython(root, file, moduleName, level, virtualFiles);
          if (resolved.path) edges.push({ from: file, to: resolved.path, kind: 'import', confidence: resolved.confidence, evidence: { file, line: i + 1, specifier: `${'.'.repeat(level)}${moduleName}` } });
          else diagnostics.push({ code: 'GRAPH001', severity: 'warning', subsystem: 'graph', message: `Unresolved Python import in ${file}:${i + 1}` });
          continue;
        }
        match = /^\s*import\s+([A-Za-z_][\w.]*)/.exec(line);
        if (match) {
          const specifier = match[1] ?? '';
          const resolved = await resolvePython(root, file, specifier, 0, virtualFiles);
          if (resolved.path) edges.push({ from: file, to: resolved.path, kind: 'import', confidence: resolved.confidence, evidence: { file, line: i + 1, specifier } });
        }
        if (/\b(importlib|__import__)\b/.test(line)) limitations.push(`Dynamic Python loading observed in ${file}:${i + 1}`);
      }
    } else {
      const patterns: Array<[RegExp, DependencyEdge['kind']]> = [
        [/\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g, 'import'],
        [/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, 'require'],
        [/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, 'dynamic-import']
      ];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        for (const [pattern, kind] of patterns) {
          for (const match of line.matchAll(pattern)) {
            const specifier = match[1] ?? '';
            const resolved = await resolveJs(root, file, specifier, jsResolver);
            if (resolved.path) edges.push({ from: file, to: resolved.path, kind, confidence: kind === 'dynamic-import' ? Math.min(0.85, resolved.confidence) : resolved.confidence, evidence: { file, line: i + 1, specifier } });
            else {
              const knownAlias = jsResolver.paths.some(mapping => aliasCapture(mapping.key, specifier) !== undefined) || [...jsResolver.workspaces.keys()].some(name => specifier === name || specifier.startsWith(`${name}/`));
              if (specifier.startsWith('.') || knownAlias) diagnostics.push({ code: 'GRAPH001', severity: 'warning', subsystem: 'graph', message: `Unresolved import ${specifier} in ${file}:${i + 1}` });
            }
          }
        }
        if (/\bimport\(\s*[^'"\s]/.test(line)) limitations.push(`Nonliteral dynamic import in ${file}:${i + 1}`);
      }
    }
  }
  const sorted = edges.sort((a, b) => `${a.from}\0${a.to}\0${a.kind}`.localeCompare(`${b.from}\0${b.to}\0${b.kind}`));
  const reverse = new Map<string, DependencyEdge[]>();
  for (const edge of sorted) {
    const list = reverse.get(edge.to) ?? [];
    list.push(edge);
    reverse.set(edge.to, list);
  }
  return { files, edges: sorted, reverse, limitations: [...new Set(limitations)].sort(), diagnostics };
}
