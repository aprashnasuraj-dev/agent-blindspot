import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadCoverage } from '../../packages/evidence/src/coverage.js';
import { EvidenceIndex } from '../../packages/evidence/src/index.js';
import { createPathContext } from '../../packages/git/src/path.js';
import { buildReport, renderHtml } from '../../packages/report/src/index.js';
import type { CandidateFinding } from '../../packages/schema/src/index.js';

test('LCOV, coverage.py, and Istanbul formats map repository paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-blindspot-cov-'));
  try {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1;\n', 'utf8');
    const ctx = await createPathContext(root);

    const lcov = join(root, 'lcov.info');
    await writeFile(lcov, 'TN:\nSF:src/a.ts\nDA:1,1\nend_of_record\n', 'utf8');
    assert.ok((await loadCoverage(lcov, ctx)).covered.has('src/a.ts'));

    const coveragePy = join(root, 'coverage.json');
    await writeFile(coveragePy, JSON.stringify({ files: { 'src/a.ts': { executed_lines: [1] } } }), 'utf8');
    assert.ok((await loadCoverage(coveragePy, ctx)).covered.has('src/a.ts'));

    const istanbul = join(root, 'istanbul.json');
    await writeFile(istanbul, JSON.stringify({ 'src/a.ts': { path: 'src/a.ts', statementMap: {}, s: {} } }), 'utf8');
    assert.ok((await loadCoverage(istanbul, ctx)).covered.has('src/a.ts'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('standalone HTML escapes hostile paths, exposes evidence detail, and forbids network connections', () => {
  const finding: CandidateFinding = {
    path: '<script>alert(1)</script>.ts',
    changed: false,
    inspected: false,
    modifiedByAgent: false,
    directlyCovered: false,
    relevance: 1,
    distance: 1,
    pathConfidence: 1,
    rootChangedPath: 'src/root.ts',
    dependencyPath: ['src/root.ts', '<script>alert(1)</script>.ts'],
    states: ['POSSIBLE_BLIND_SPOT'],
    limitations: [],
    evidence: { inspection: [], verification: [] }
  };
  const report = buildReport({
    version: '0.1.0',
    root: '/private/home/user/repo',
    base: 'HEAD',
    head: 'WORKTREE',
    config: { depth: 2, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2, redactPaths: true },
    findings: [finding],
    evidence: new EvidenceIndex(),
    diagnostics: [],
    limitations: [],
    generatedAt: '2026-09-11T00:00:00.000Z'
  });
  const html = renderHtml(report);
  assert.equal(report.repository.root, '[REDACTED]');
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;\.ts/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /No qualifying inspection evidence observed/);
  assert.match(html, /not proof of a defect/i);
});
