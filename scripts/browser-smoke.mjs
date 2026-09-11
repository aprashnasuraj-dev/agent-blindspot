import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { buildReport, renderHtml } from '../dist/packages/report/src/index.js';
import { EvidenceIndex } from '../dist/packages/evidence/src/index.js';

const target = 10_000;
const findings = Array.from({ length: target }, (_, i) => ({
  path: `src/file-${String(i).padStart(5, '0')}.ts`,
  changed: i < 10,
  inspected: i % 2 === 0,
  modifiedByAgent: false,
  directlyCovered: i % 3 === 0,
  relevance: 1 / (1 + (i % 3)),
  distance: i < 10 ? 0 : 1,
  pathConfidence: 1,
  rootChangedPath: 'src/root.ts',
  dependencyPath: ['src/root.ts', `src/file-${String(i).padStart(5, '0')}.ts`],
  states: i < 10 ? ['CHANGED'] : (i % 2 ? ['POSSIBLE_BLIND_SPOT'] : ['INSPECTED']),
  limitations: [],
  evidence: { inspection: i % 2 === 0 ? [`codex:file_read via read_file (event ${i + 1})`] : [], verification: i % 3 === 0 ? ['coverage:benchmark artifact'] : [] }
}));
const report = buildReport({
  version: '0.1.0', root: '[browser-smoke]', base: 'HEAD', head: 'WORKTREE',
  config: { depth: 2, lambda: 0.6, minEdgeConfidence: 0.5, blindspotThreshold: 0.2, redactPaths: true },
  findings, evidence: new EvidenceIndex(), diagnostics: [], limitations: [], generatedAt: '2026-01-01T00:00:00.000Z'
});
const html = renderHtml(report);
if (!html.includes('src/file-09999.ts')) throw new Error('10k report render is incomplete');

async function firstExecutable(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes('/') || candidate.includes('\\')) {
      try { await access(candidate); return candidate; } catch { continue; }
    }
    const probe = spawn(process.platform === 'win32' ? 'where' : 'sh', process.platform === 'win32' ? [candidate] : ['-lc', `command -v ${candidate}`], { stdio: 'ignore' });
    const code = await new Promise(resolve => probe.on('close', resolve));
    if (code === 0) return candidate;
  }
  return undefined;
}

const browser = await firstExecutable([
  process.env.AGENT_BLINDSPOT_BROWSER,
  'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'
]);
if (!browser) throw new Error('No Chromium/Chrome executable available for browser-scale report smoke');

const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-browser-'));
try {
  const reportPath = join(temp, 'report.html');
  await writeFile(reportPath, html, 'utf8');
  const url = pathToFileURL(reportPath).href;
  const started = performance.now();
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--dump-dom', url];
  const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { if (stderr.length < 16_384) stderr += chunk; });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 15_000);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  clearTimeout(timer);
  const seconds = (performance.now() - started) / 1000;
  if (timedOut) throw new Error(`Browser smoke environment timed out after ${seconds.toFixed(3)}s: ${stderr.slice(-4000)}`);
  if (code !== 0) throw new Error(`Browser smoke failed (${code}): ${stderr.slice(-4000)}`);
  if (seconds > 5) throw new Error(`10k-node report browser smoke exceeded 5s target: ${seconds.toFixed(3)}s`);
  console.log(JSON.stringify({ browser, findings: target, htmlBytes: Buffer.byteLength(html), seconds: Number(seconds.toFixed(3)), targetSeconds: 5, result: 'PASS' }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
