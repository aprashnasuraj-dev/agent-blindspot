import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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
if (report.findings.length !== target) throw new Error('10k report model is incomplete');
if (!html.includes('showing the first 1000 of 10000 findings')) throw new Error('large-report aggregation notice is missing');
if (!html.includes('src/file-00000.ts')) throw new Error('initial impact list is missing expected findings');

async function executable(candidate) {
  if (!candidate) return undefined;
  if (candidate.includes('/') || candidate.includes('\\')) {
    try { await access(candidate); return candidate; } catch { return undefined; }
  }
  try {
    const probe = spawn(candidate, ['--version'], { stdio: 'ignore', shell: false });
    const code = await Promise.race([
      new Promise(resolveCode => probe.on('close', resolveCode)),
      new Promise(resolveTimeout => setTimeout(() => { probe.kill('SIGKILL'); resolveTimeout(1); }, 2000))
    ]);
    return code === 0 ? candidate : undefined;
  } catch {
    return undefined;
  }
}

async function firstExecutable(candidates) {
  for (const candidate of candidates) {
    const found = await executable(candidate);
    if (found) return found;
  }
  return undefined;
}

const browser = await firstExecutable([
  process.env.AGENT_BLINDSPOT_BROWSER,
  'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'chrome'
]);
if (!browser) throw new Error('No Chromium/Chrome executable available for browser-scale report smoke');
const dbusRun = process.platform === 'linux' ? await firstExecutable(['dbus-run-session']) : undefined;

function sleep(ms) { return new Promise(resolveSleep => setTimeout(resolveSleep, ms)); }

async function waitForDevTools(port, deadlineMs) {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const pages = await response.json();
        const page = pages.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {
      // Browser is still starting.
    }
    await sleep(50);
  }
  throw new Error('Chromium DevTools endpoint did not become ready');
}

async function connectCdp(url) {
  if (typeof WebSocket !== 'function') throw new Error('Node runtime does not provide WebSocket required for browser smoke');
  const ws = new WebSocket(url);
  await new Promise((resolveOpen, reject) => {
    ws.addEventListener('open', resolveOpen, { once: true });
    ws.addEventListener('error', () => reject(new Error('Failed to connect to Chromium DevTools WebSocket')), { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message ?? 'CDP command failed'));
    else waiter.resolve(message.result ?? {});
  });
  return {
    ws,
    command(method, params = {}) {
      return new Promise((resolveCommand, rejectCommand) => {
        const id = ++nextId;
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
  };
}

const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-browser-'));
let child;
try {
  const reportPath = join(temp, 'report.html');
  const profilePath = join(temp, 'chrome-profile');
  await writeFile(reportPath, html, 'utf8');
  const url = pathToFileURL(reportPath).href;
  const port = 9222;
  const browserArgs = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-first-run',
    `--user-data-dir=${profilePath}`,
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    'about:blank'
  ];
  const command = dbusRun ?? browser;
  const args = dbusRun ? ['--', browser, ...browserArgs] : browserArgs;
  const detached = process.platform !== 'win32';
  child = spawn(command, args, { detached, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { if (stderr.length < 16_384) stderr += chunk; });

  const page = await waitForDevTools(port, 15_000).catch(error => {
    throw new Error(`${error.message}: ${stderr.slice(-4000)}`);
  });
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  const started = performance.now();
  await cdp.command('Page.navigate', { url });

  let observed;
  const deadline = performance.now() + 10_000;
  while (performance.now() < deadline) {
    const result = await cdp.command('Runtime.evaluate', {
      expression: `JSON.stringify({ready:document.readyState,href:location.href,rows:document.querySelectorAll('tbody tr').length,notice:document.body.innerText.includes('showing the first 1000 of 10000 findings')})`,
      returnByValue: true
    });
    observed = JSON.parse(result.result?.value ?? '{}');
    if (observed.ready === 'complete' && observed.href === url && observed.rows >= 1000 && observed.notice === true) break;
    await sleep(20);
  }
  const seconds = (performance.now() - started) / 1000;
  cdp.ws.close();
  if (!observed || observed.ready !== 'complete' || observed.href !== url || observed.rows < 1000 || observed.notice !== true) {
    throw new Error(`10k report did not become usable within 10s: ${JSON.stringify(observed)}`);
  }
  if (seconds > 5) throw new Error(`10k-node report browser smoke exceeded 5s target: ${seconds.toFixed(3)}s`);
  console.log(JSON.stringify({ browser, dbusSession: Boolean(dbusRun), findings: target, initialRows: observed.rows, htmlBytes: Buffer.byteLength(html), seconds: Number(seconds.toFixed(3)), targetSeconds: 5, result: 'PASS' }, null, 2));
} finally {
  if (child && child.exitCode === null) {
    try {
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
      else child.kill('SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
  await rm(temp, { recursive: true, force: true });
}
