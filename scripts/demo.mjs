import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = join(root, 'examples', 'auth-redirect-demo');
const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-demo-'));
const repo = join(temp, 'repo');
const output = join(temp, 'report');

function run(command, args, cwd = repo) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr}`)));
  });
}

try {
  await mkdir(repo, { recursive: true });
  await cp(join(fixture, 'before'), repo, { recursive: true });
  await run('git', ['init', '-q']);
  await run('git', ['config', 'user.name', 'AgentBlindspot Demo']);
  await run('git', ['config', 'user.email', 'demo@agentblindspot.invalid']);
  await run('git', ['add', '.']);
  await run('git', ['commit', '-qm', 'baseline']);
  await cp(join(fixture, 'after'), repo, { recursive: true, force: true });

  const cli = join(root, 'dist', 'apps', 'cli', 'src', 'index.js');
  const session = join(fixture, 'fixture', 'claude-session.json');
  await run(process.execPath, [cli, 'analyze', repo, '--agent', 'claude', '--session', session, '--output', output, '--redact-paths', '--no-open'], root);
  const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
  const middleware = report.findings.find(item => item.path === 'src/admin/middleware.ts');
  if (!middleware?.states?.includes('POSSIBLE_BLIND_SPOT')) throw new Error('Demo invariant failed: admin middleware was not a possible blind spot.');
  if (report.summary.testsObserved !== 1) throw new Error(`Demo invariant failed: expected 1 test command, got ${report.summary.testsObserved}.`);
  if (middleware.relevance !== 1) throw new Error(`Demo invariant failed: expected direct relevance 1, got ${middleware.relevance}.`);
  console.log('AgentBlindspot demo PASS');
  console.log(`changed=${report.summary.changedFiles} candidates=${report.summary.candidateImpactedFiles} possibleBlindSpots=${report.summary.possibleBlindSpots} testsObserved=${report.summary.testsObserved}`);
  console.log(`finding=${middleware.path} state=${middleware.states.join('+')} relevance=${middleware.relevance}`);
} finally {
  await rm(temp, { recursive: true, force: true });
}
