#!/usr/bin/env node
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPathContext, normalizeRepoPath } from '../../../packages/git/src/path.js';
import { findRepoRoot, getDiff, remapRenamedPath } from '../../../packages/git/src/index.js';
import { buildGraph } from '../../../packages/graph/src/index.js';
import { EvidenceIndex } from '../../../packages/evidence/src/index.js';
import { loadCoverage } from '../../../packages/evidence/src/coverage.js';
import { capabilities, discoverSessions, resolveLatestSession, streamSession, type AgentId } from '../../../packages/adapters/src/index.js';
import { classifyCandidates, traverseImpact } from '../../../packages/core/src/index.js';
import { buildReport, writeReport } from '../../../packages/report/src/index.js';
import type { Diagnostic } from '../../../packages/schema/src/index.js';

const VERSION = '0.1.0';

type Format = 'html' | 'json' | 'both';
interface CliOptions {
  command: 'analyze' | 'doctor' | 'adapters' | 'schema';
  path: string;
  agent: 'auto' | AgentId;
  session?: string;
  base: string;
  head: string;
  coverage?: string;
  depth: number;
  format: Format;
  output: string;
  redactPaths: boolean;
  strict: boolean;
  printSchema: boolean;
}

function usage(): string {
  return `AgentBlindspot ${VERSION}\n\nUsage:\n  agent-blindspot [path] [options]\n  agent-blindspot analyze [path] [options]\n  agent-blindspot doctor [path]\n  agent-blindspot adapters\n  agent-blindspot schema --print\n\nOptions:\n  --agent auto|codex|claude|opencode\n  --session <path|latest>\n  --base <git-ref>\n  --head <git-ref|WORKTREE>\n  --coverage <path>\n  --depth 1|2|3\n  --format html|json|both\n  --output <dir>\n  --redact-paths\n  --strict\n  --no-open   accepted for compatibility; reports are not auto-opened in V1\n  --version\n  --help`;
}

function parseArgs(argv: string[]): CliOptions {
  let command: CliOptions['command'] = 'analyze';
  let path = '.';
  let i = 0;
  if (['analyze', 'doctor', 'adapters', 'schema'].includes(argv[0] ?? '')) command = argv[i++] as CliOptions['command'];
  else if (argv[0] && !argv[0].startsWith('-')) { path = argv[0]; i++; }
  if ((command === 'analyze' || command === 'doctor') && argv[i] && !argv[i]!.startsWith('-')) { path = argv[i]!; i++; }
  const out: CliOptions = { command, path, agent: 'auto', base: 'HEAD', head: 'WORKTREE', depth: 2, format: 'both', output: 'agent-blindspot-report', redactPaths: false, strict: false, printSchema: false };
  while (i < argv.length) {
    const arg = argv[i++] ?? '';
    const need = (): string => { const v = argv[i++]; if (!v) throw new Error(`Missing value for ${arg}`); return v; };
    if (arg === '--agent') out.agent = need() as CliOptions['agent'];
    else if (arg === '--session') out.session = need();
    else if (arg === '--base') out.base = need();
    else if (arg === '--head') out.head = need();
    else if (arg === '--coverage') out.coverage = need();
    else if (arg === '--depth') out.depth = Number(need());
    else if (arg === '--format') out.format = need() as Format;
    else if (arg === '--output') out.output = need();
    else if (arg === '--redact-paths') out.redactPaths = true;
    else if (arg === '--strict') out.strict = true;
    else if (arg === '--print') out.printSchema = true;
    else if (arg === '--no-open') { /* V1 never auto-opens. */ }
    else if (arg === '--help' || arg === '-h') { console.log(usage()); process.exit(0); }
    else if (arg === '--version' || arg === '-v') { console.log(VERSION); process.exit(0); }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (![1, 2, 3].includes(out.depth)) throw new Error('--depth must be 1, 2, or 3');
  if (!['auto', 'codex', 'claude', 'opencode'].includes(out.agent)) throw new Error(`Unsupported agent: ${out.agent}`);
  if (!['html', 'json', 'both'].includes(out.format)) throw new Error(`Unsupported format: ${out.format}`);
  return out;
}

async function doctor(path: string, redactPaths: boolean): Promise<void> {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  console.log(`AgentBlindspot doctor\n Node: ${process.versions.node} ${nodeMajor >= 22 ? 'OK' : 'UNSUPPORTED'}`);
  try {
    const root = await findRepoRoot(resolve(path));
    console.log(` Git: available OK\n Repo root: ${redactPaths ? '[REDACTED]' : root} OK`);
    const graph = await buildGraph(root);
    const ts = graph.files.filter(f => /\.[cm]?[jt]sx?$/.test(f)).length;
    const py = graph.files.filter(f => f.endsWith('.py')).length;
    console.log(` Languages:\n  JS/TS: ${ts} files SUPPORTED (file/module)\n  Python: ${py} files SUPPORTED (file/module)`);
    const codexCandidates = await discoverSessions('codex', root, 20);
    const matchingCodex = codexCandidates.filter(item => item.repositoryMatch).length;
    console.log(` Agent candidates:\n  Codex: ${matchingCodex} repository-matched / ${codexCandidates.length} recent candidates (best-effort)`);
  } catch (error) {
    console.log(` Git/repository: ERROR ${(error as Error).message}`);
  }
  console.log(' Agent adapters:');
  for (const id of ['codex', 'claude', 'opencode'] as const) {
    const c = capabilities(id);
    console.log(`  ${id}: explicit import ${c.explicitImport ? 'READY' : 'NO'}; auto-discovery ${c.autoDiscovery}`);
  }
}

function printAdapters(): void {
  console.log(JSON.stringify((['codex', 'claude', 'opencode'] as const).map(capabilities), null, 2));
}

function printSchema(): void {
  console.log(JSON.stringify({ NormalizedEvent: { schemaVersion: 1, required: ['seq', 'source', 'kind', 'confidence', 'adapter'] }, reportSchemaVersion: 1 }, null, 2));
}

async function analyze(opts: CliOptions): Promise<void> {
  const root = await findRepoRoot(resolve(opts.path));
  const diff = await getDiff(root, opts.base, opts.head);
  if (diff.files.length === 0) { console.error('No usable repository diff.'); process.exitCode = 3; return; }
  const pathCtx = await createPathContext(root, root);
  const virtualFiles = diff.files.flatMap(file => file.status === 'deleted' ? [file.path] : (file.status === 'renamed' && file.oldPath ? [file.oldPath] : []));
  const graph = await buildGraph(root, { virtualFiles });
  const evidence = new EvidenceIndex();
  const diagnostics: Diagnostic[] = [...graph.diagnostics];
  const limitations = [...graph.limitations];
  let sessionUsable = false;
  let selectedSession = opts.session;
  let selectedAgent: AgentId | undefined;
  if (selectedSession === 'latest') {
    selectedAgent = opts.agent === 'auto' ? 'codex' : opts.agent;
    selectedSession = await resolveLatestSession(selectedAgent, root, false);
    if (!selectedSession) {
      console.error(`Requested latest ${selectedAgent} session could not be discovered.`);
      process.exitCode = 4;
      return;
    }
  } else if (!selectedSession && (opts.agent === 'auto' || opts.agent === 'codex')) {
    const candidate = await resolveLatestSession('codex', root, true);
    if (candidate) {
      selectedSession = candidate;
      selectedAgent = 'codex';
      diagnostics.push({ code: 'ADP004', severity: 'info', subsystem: 'adapter', message: 'Best-effort Codex auto-discovery selected the newest repository-matched rollout.' });
    }
  }
  if (selectedSession) {
    const agent: AgentId = selectedAgent ?? (opts.agent === 'auto' ? (selectedSession.endsWith('.jsonl') || selectedSession.endsWith('.ndjson') ? 'codex' : 'claude') : opts.agent);
    try {
      const parsed = streamSession(agent, resolve(selectedSession), pathCtx, opts.strict);
      for await (const event of parsed.events) {
        const mapped = event.path ? { ...event, path: remapRenamedPath(event.path, diff.files) } : event;
        evidence.ingest(mapped);
      }
      diagnostics.push(...parsed.diagnostics);
      sessionUsable = true;
    } catch (error) {
      console.error(`Requested session cannot be parsed: ${(error as Error).message}`);
      process.exitCode = 4;
      return;
    }
  } else {
    diagnostics.push({ code: 'ADP003', severity: 'warning', subsystem: 'adapter', message: 'No usable agent session supplied or repository-matched session discovered; candidate inspection state is unknown.', remediation: 'Pass --session <structured-session-file|latest> and --agent <id>.' });
    limitations.push('No usable agent session was supplied or safely auto-discovered. Candidate inspection evidence is unknown, so possible blind spots are not asserted.');
  }
  if (opts.coverage) {
    const coverage = await loadCoverage(resolve(opts.coverage), pathCtx);
    coverage.covered.forEach(path => evidence.markCovered(path, `coverage artifact: ${opts.coverage ?? 'unknown'}`));
    diagnostics.push(...coverage.diagnostics);
  }
  const config = { depth: opts.depth, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2 };
  const changedPaths = diff.files.filter(f => !f.generated).map(f => f.path);
  const candidates = traverseImpact(changedPaths, graph.reverse, config);
  const unknownPaths = new Set<string>();
  if (!sessionUsable) candidates.forEach(c => { if (!changedPaths.includes(c.path)) unknownPaths.add(c.path); });
  const findings = classifyCandidates(candidates, diff.files, evidence, unknownPaths);
  const report = buildReport({
    version: VERSION,
    root,
    base: diff.base,
    head: diff.head,
    config: { ...config, redactPaths: opts.redactPaths },
    findings,
    evidence,
    diagnostics,
    limitations
  });
  await mkdir(resolve(opts.output), { recursive: true });
  await writeReport(resolve(opts.output), report, opts.format);
  console.log(`AgentBlindspot: ${report.summary.changedFiles} changed, ${report.summary.candidateImpactedFiles} candidate impacted, ${report.summary.possibleBlindSpots} possible blind spots.`);
  console.log(`Report written to ${resolve(opts.output)}`);
  if (opts.strict && diagnostics.some(item => item.severity === 'error')) process.exitCode = 5;
}

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) { console.log(usage()); return; }
    if (argv.includes('--version') || argv.includes('-v')) { console.log(VERSION); return; }
    const opts = parseArgs(argv);
    if (opts.command === 'doctor') await doctor(opts.path, opts.redactPaths);
    else if (opts.command === 'adapters') printAdapters();
    else if (opts.command === 'schema') printSchema();
    else await analyze(opts);
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 2;
  }
}

await main();
