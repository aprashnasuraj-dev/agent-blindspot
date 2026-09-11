import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
function run(command, args, cwd = root) {
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

const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-pack-'));
try {
  const packed = await run('npm', ['pack', '--json']);
  const info = JSON.parse(packed.stdout);
  const filename = info[0]?.filename;
  if (!filename) throw new Error('npm pack did not return a tarball filename');
  const tarball = join(root, filename);
  const bytes = await readFile(tarball);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const installDir = join(temp, 'consumer');
  await run('npm', ['init', '-y'], temp);
  await run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], temp);
  const bin = process.platform === 'win32'
    ? join(temp, 'node_modules', '.bin', 'agent-blindspot.cmd')
    : join(temp, 'node_modules', '.bin', 'agent-blindspot');
  const version = await run(bin, ['--version'], temp);
  const help = await run(bin, ['--help'], temp);
  if (version.stdout.trim() !== '0.1.0') throw new Error(`installed artifact version mismatch: ${version.stdout.trim()}`);
  if (!help.stdout.includes('AgentBlindspot 0.1.0')) throw new Error('installed artifact --help smoke failed');
  const evidence = { filename: basename(tarball), sha256, size: bytes.length, version: version.stdout.trim(), help: 'PASS' };
  console.log(JSON.stringify(evidence, null, 2));
  if (process.env.AGENT_BLINDSPOT_PACKAGE_EVIDENCE) {
    await writeFile(process.env.AGENT_BLINDSPOT_PACKAGE_EVIDENCE, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }
  await rm(tarball, { force: true });
} finally {
  await rm(temp, { recursive: true, force: true });
}
