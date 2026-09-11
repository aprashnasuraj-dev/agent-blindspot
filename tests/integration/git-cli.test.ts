import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { getDiff } from '../../packages/git/src/index.js';

function run(command: string, args: string[], cwd: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function mustRun(command: string, args: string[], cwd: string): string {
  const result = run(command, args, cwd);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function initRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  mustRun('git', ['init', '-q'], path);
  mustRun('git', ['config', 'user.name', 'AgentBlindspot Test'], path);
  mustRun('git', ['config', 'user.email', 'test@agentblindspot.invalid'], path);
}

test('commit-range diff preserves text ranges, binary metadata, and opaque submodule state', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-git-'));
  const root = join(temp, 'repo');
  const child = join(temp, 'child');
  try {
    await initRepo(root);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, '.gitattributes'), '*.bin binary\n', 'utf8');
    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 1;\n', 'utf8');
    mustRun('git', ['add', '.'], root);
    mustRun('git', ['commit', '-qm', 'baseline'], root);
    const base = mustRun('git', ['rev-parse', 'HEAD'], root);

    await initRepo(child);
    await writeFile(join(child, 'README.md'), '# child\n', 'utf8');
    mustRun('git', ['add', '.'], child);
    mustRun('git', ['commit', '-qm', 'child'], child);

    await writeFile(join(root, 'src', 'a.ts'), 'export const a = 2;\nexport const b = 3;\n', 'utf8');
    await writeFile(join(root, 'assets.bin'), Buffer.from([0, 1, 2, 3]));
    mustRun('git', ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', child, 'vendor/sub'], root);
    mustRun('git', ['add', '.'], root);
    mustRun('git', ['commit', '-qm', 'candidate'], root);
    const head = mustRun('git', ['rev-parse', 'HEAD'], root);

    const diff = await getDiff(root, base, head);
    const source = diff.files.find(file => file.path === 'src/a.ts');
    const binary = diff.files.find(file => file.path === 'assets.bin');
    const submodule = diff.files.find(file => file.path === 'vendor/sub');
    assert.equal(source?.status, 'modified');
    assert.ok(source?.changedRanges?.some(range => range.start === 1));
    assert.equal(binary?.binary, true);
    assert.equal(submodule?.submodule, true);
    assert.equal(submodule?.parseStatus, 'unsupported');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('strict adapter parse loss exits 5 and doctor redacts the repository root', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'agent-blindspot-cli-'));
  const root = join(temp, 'repo');
  try {
    await initRepo(root);
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'dep.ts'), 'export const dep = 1;\n', 'utf8');
    await writeFile(join(root, 'src', 'main.ts'), "import { dep } from './dep.js';\nexport const main = dep;\n", 'utf8');
    mustRun('git', ['add', '.'], root);
    mustRun('git', ['commit', '-qm', 'baseline'], root);
    await writeFile(join(root, 'src', 'dep.ts'), 'export const dep = 2;\n', 'utf8');

    const badSession = join(temp, 'bad.jsonl');
    await writeFile(badSession, '{malformed json}\n', 'utf8');
    const cli = resolve(process.cwd(), 'dist', 'apps', 'cli', 'src', 'index.js');
    const strictResult = run(process.execPath, [cli, 'analyze', root, '--agent', 'codex', '--session', badSession, '--strict', '--output', join(temp, 'report')], root);
    assert.equal(strictResult.status, 5, strictResult.stderr);

    const doctor = run(process.execPath, [cli, 'doctor', root, '--redact-paths'], root);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Repo root: \[REDACTED\] OK/);
    assert.equal(doctor.stdout.includes(root), false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
