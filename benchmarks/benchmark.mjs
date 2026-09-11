import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { streamSession } from '../dist/packages/adapters/src/index.js';
import { traverseImpact } from '../dist/packages/core/src/index.js';
import { EvidenceIndex } from '../dist/packages/evidence/src/index.js';
import { createPathContext } from '../dist/packages/git/src/path.js';
import { buildGraph } from '../dist/packages/graph/src/index.js';
import { buildReport, renderHtml } from '../dist/packages/report/src/index.js';

const full = process.argv.includes('--full');
const sessionBytesTarget = full ? 1024 ** 3 : 32 * 1024 ** 2;
const graphFilesTarget = full ? 10_000 : 1_000;
const edgeTarget = full ? 100_000 : 20_000;
const reportTarget = full ? 10_000 : 2_000;
const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-bench-'));
const repo = join(temp, 'repo');
await mkdir(join(repo, 'src'), { recursive: true });
await writeFile(join(repo, 'src', 'x.ts'), 'export const x = 1;\n', 'utf8');
const ctx = await createPathContext(repo);

function result(name, started, extra = {}) {
  return { name, seconds: Number(((performance.now() - started) / 1000).toFixed(3)), ...extra };
}

async function writeSyntheticSession(file, targetBytes) {
  const padding = 'x'.repeat(256 * 1024);
  const line = `${JSON.stringify({ toolName: 'Read', input: { file_path: 'src/x.ts' }, padding })}\n`;
  const stream = createWriteStream(file, { encoding: 'utf8' });
  let bytes = 0;
  while (bytes < targetBytes) {
    if (!stream.write(line)) await once(stream, 'drain');
    bytes += Buffer.byteLength(line);
  }
  stream.end();
  await once(stream, 'finish');
  return bytes;
}

try {
  const session = join(temp, 'session.jsonl');
  const actualBytes = await writeSyntheticSession(session, sessionBytesTarget);
  let peakRss = process.memoryUsage().rss;
  let events = 0;
  const evidence = new EvidenceIndex();
  const ingestion = streamSession('codex', session, ctx, false);
  let started = performance.now();
  for await (const event of ingestion.events) {
    evidence.ingest(event);
    events++;
    if ((events & 127) === 0) peakRss = Math.max(peakRss, process.memoryUsage().rss);
  }
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  const ingestResult = result('session-ingestion', started, { bytes: actualBytes, events, peakRssMiB: Number((peakRss / 1024 / 1024).toFixed(1)) });

  const graphRepo = join(temp, 'graph-repo');
  await mkdir(join(graphRepo, 'src'), { recursive: true });
  for (let startIndex = 0; startIndex < graphFilesTarget; startIndex += 100) {
    const batch = [];
    for (let i = startIndex; i < Math.min(graphFilesTarget, startIndex + 100); i++) {
      const name = `f${String(i).padStart(5, '0')}.ts`;
      const prior = i === 0 ? '' : `import './f${String(i - 1).padStart(5, '0')}.js';\n`;
      batch.push(writeFile(join(graphRepo, 'src', name), `${prior}export const v${i} = ${i};\n`, 'utf8'));
    }
    await Promise.all(batch);
  }
  started = performance.now();
  const graph = await buildGraph(graphRepo);
  const graphResult = result('graph-build', started, { files: graphFilesTarget, edges: graph.edges.length });

  const reverse = new Map([['src/root.ts', Array.from({ length: edgeTarget }, (_, i) => ({
    from: `src/dependent-${i}.ts`, to: 'src/root.ts', kind: 'import', confidence: 1, evidence: { file: `src/dependent-${i}.ts`, specifier: './root.js' }
  }))]]);
  started = performance.now();
  const candidates = traverseImpact(['src/root.ts'], reverse, { depth: 2, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2 });
  const traversalResult = result('impact-traversal', started, { edges: edgeTarget, candidates: candidates.length });

  const findings = Array.from({ length: reportTarget }, (_, i) => ({
    path: `src/file-${i}.ts`, changed: i < 10, inspected: i % 2 === 0, modifiedByAgent: false, directlyCovered: i % 3 === 0,
    relevance: 1 / (1 + (i % 3)), distance: i < 10 ? 0 : 1, pathConfidence: 1, rootChangedPath: 'src/root.ts',
    dependencyPath: ['src/root.ts', `src/file-${i}.ts`], states: i < 10 ? ['CHANGED'] : (i % 2 ? ['POSSIBLE_BLIND_SPOT'] : ['INSPECTED']), limitations: []
  }));
  started = performance.now();
  const report = buildReport({ version: '0.1.0', root: '[benchmark]', base: 'HEAD', head: 'WORKTREE', config: { depth: 2, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2, redactPaths: true }, findings, evidence: new EvidenceIndex(), diagnostics: [], limitations: [], generatedAt: '2026-01-01T00:00:00.000Z' });
  const html = renderHtml(report);
  const reportResult = result('report-render-node', started, { findings: reportTarget, htmlBytes: Buffer.byteLength(html) });

  const output = { mode: full ? 'full' : 'smoke', node: process.version, platform: `${process.platform}-${process.arch}`, results: [ingestResult, graphResult, traversalResult, reportResult] };
  console.log(JSON.stringify(output, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
