import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyCandidates, traverseImpact, weightedCoverage } from '../../packages/core/src/index.js';
import { EvidenceIndex, classifyCommand } from '../../packages/evidence/src/index.js';
import type { DependencyEdge, FileNode, NormalizedEvent } from '../../packages/schema/src/index.js';

const changedFile: FileNode = {
  id: 'root',
  path: 'src/session.ts',
  language: 'typescript',
  status: 'modified',
  parseStatus: 'ok'
};

function reverseGraph(): Map<string, DependencyEdge[]> {
  return new Map([
    ['src/session.ts', [{ from: 'src/middleware.ts', to: 'src/session.ts', kind: 'import', confidence: 1, evidence: { file: 'src/middleware.ts', line: 1, specifier: './session.js' } }]],
    ['src/middleware.ts', [{ from: 'src/route.ts', to: 'src/middleware.ts', kind: 'import', confidence: 0.95, evidence: { file: 'src/route.ts', line: 1, specifier: './middleware.js' } }]]
  ]);
}

test('reverse impact is deterministic and relevance decays by distance', () => {
  const config = { depth: 2, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2 };
  const first = traverseImpact(['src/session.ts'], reverseGraph(), config);
  const second = traverseImpact(['src/session.ts'], reverseGraph(), config);
  assert.deepEqual(first, second);
  const middleware = first.find(item => item.path === 'src/middleware.ts');
  const route = first.find(item => item.path === 'src/route.ts');
  assert.equal(middleware?.relevance, 1);
  assert.equal(route?.relevance, 0.57);
});

test('uninspected direct dependent is a possible blind spot', () => {
  const candidates = traverseImpact(['src/session.ts'], reverseGraph(), { depth: 1, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2 });
  const findings = classifyCandidates(candidates, [changedFile], new EvidenceIndex());
  const middleware = findings.find(item => item.path === 'src/middleware.ts');
  assert.ok(middleware?.states.includes('POSSIBLE_BLIND_SPOT'));
});

test('inspection, direct coverage, and unknown independently suppress the default blind-spot state', () => {
  const candidates = traverseImpact(['src/session.ts'], reverseGraph(), { depth: 1, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2 });
  const inspected = new EvidenceIndex();
  const event: NormalizedEvent = { schemaVersion: 1, seq: 1, source: 'claude', kind: 'file_read', path: 'src/middleware.ts', confidence: 'observed', adapter: { name: 'fixture', version: '1' } };
  inspected.ingest(event);
  assert.equal(classifyCandidates(candidates, [changedFile], inspected).find(item => item.path === 'src/middleware.ts')?.states.includes('POSSIBLE_BLIND_SPOT'), false);

  const covered = new EvidenceIndex();
  covered.markCovered('src/middleware.ts');
  assert.equal(classifyCandidates(candidates, [changedFile], covered).find(item => item.path === 'src/middleware.ts')?.states.includes('POSSIBLE_BLIND_SPOT'), false);

  const unknown = classifyCandidates(candidates, [changedFile], new EvidenceIndex(), new Set(['src/middleware.ts'])).find(item => item.path === 'src/middleware.ts');
  assert.ok(unknown?.states.includes('UNKNOWN'));
  assert.equal(unknown?.states.includes('POSSIBLE_BLIND_SPOT'), false);
});

test('test commands remain separate from direct coverage', () => {
  const evidence = new EvidenceIndex();
  evidence.ingest({ schemaVersion: 1, seq: 1, source: 'codex', kind: 'command_end', command: 'pnpm test', exitCode: 0, confidence: 'observed', adapter: { name: 'fixture', version: '1' } });
  assert.equal(evidence.testCount(), 1);
  assert.equal(evidence.isCovered('src/session.ts'), false);
  assert.equal(classifyCommand('pytest -q'), 'test');
  assert.equal(classifyCommand('tsc --noEmit'), 'typecheck');
  assert.equal(classifyCommand('eslint .'), 'lint');
  assert.equal(classifyCommand('npm run build'), 'build');
});

test('weighted coverage excludes unknown findings from the denominator', () => {
  const candidates = traverseImpact(['src/session.ts'], reverseGraph(), { depth: 1, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2 });
  const evidence = new EvidenceIndex();
  evidence.markCovered('src/session.ts');
  const findings = classifyCandidates(candidates, [changedFile], evidence, new Set(['src/middleware.ts']));
  assert.equal(weightedCoverage(findings, item => item.directlyCovered), 1);
});
