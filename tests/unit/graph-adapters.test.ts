import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { discoverSessions, parseSession, resolveLatestSession } from '../../packages/adapters/src/index.js';
import { createPathContext } from '../../packages/git/src/path.js';
import { buildGraph } from '../../packages/graph/src/index.js';

test('graph resolves relative JS, tsconfig aliases, workspace packages, Python imports, and surfaces dynamic/symlink limitations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-blindspot-graph-'));
  const outside = await mkdtemp(join(tmpdir(), 'agent-blindspot-outside-'));
  try {
    await mkdir(join(root, 'src', 'lib'), { recursive: true });
    await mkdir(join(root, 'packages', 'shared', 'src'), { recursive: true });
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@lib/*': ['src/lib/*'] } } }), 'utf8');
    await writeFile(join(root, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }), 'utf8');
    await writeFile(join(root, 'src', 'lib', 'x.ts'), 'export const x = 1;\n', 'utf8');
    await writeFile(join(root, 'src', 'relative.ts'), "import { x } from './lib/x.js';\nexport { x };\n", 'utf8');
    await writeFile(join(root, 'src', 'alias.ts'), "import { x } from '@lib/x';\nexport { x };\n", 'utf8');
    await writeFile(join(root, 'src', 'workspace.ts'), "import { shared } from '@demo/shared';\nexport { shared };\n", 'utf8');
    await writeFile(join(root, 'src', 'dynamic.ts'), "const name = './lib/' + process.env.NAME;\nvoid import(name);\n", 'utf8');
    await writeFile(join(root, 'packages', 'shared', 'package.json'), JSON.stringify({ name: '@demo/shared', source: 'src/index.ts' }), 'utf8');
    await writeFile(join(root, 'packages', 'shared', 'src', 'index.ts'), 'export const shared = 1;\n', 'utf8');
    await writeFile(join(root, 'a.py'), 'import b\n', 'utf8');
    await writeFile(join(root, 'b.py'), 'VALUE = 1\n', 'utf8');
    await writeFile(join(outside, 'escape.ts'), 'export const escaped = true;\n', 'utf8');
    await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');

    const graph = await buildGraph(root);
    assert.ok(graph.edges.some(edge => edge.from === 'src/relative.ts' && edge.to === 'src/lib/x.ts' && edge.confidence === 1));
    assert.ok(graph.edges.some(edge => edge.from === 'src/alias.ts' && edge.to === 'src/lib/x.ts' && edge.confidence === 0.95));
    assert.ok(graph.edges.some(edge => edge.from === 'src/workspace.ts' && edge.to === 'packages/shared/src/index.ts' && edge.confidence === 0.95));
    assert.ok(graph.edges.some(edge => edge.from === 'a.py' && edge.to === 'b.py'));
    assert.ok(graph.limitations.some(item => item.includes('Nonliteral dynamic import')));
    assert.ok(graph.limitations.some(item => item.includes('Symlink excluded from source graph: linked')));
    assert.equal(graph.files.includes('linked/escape.ts'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test('Codex discovery prefers repository-matched rollout and structured adapters emit tool evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-blindspot-adapter-repo-'));
  const codexHome = await mkdtemp(join(tmpdir(), 'agent-blindspot-codex-'));
  const oldCodexHome = process.env.CODEX_HOME;
  try {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src', 'main.ts'), 'export const main = 1;\n', 'utf8');
    const day = join(codexHome, 'sessions', '2026', '09', '11');
    await mkdir(day, { recursive: true });
    const rollout = join(day, 'rollout-fixture.jsonl');
    await writeFile(rollout, [
      JSON.stringify({ type: 'session_meta', payload: { cwd: root } }),
      JSON.stringify({ payload: { type: 'function_call', name: 'read_file', arguments: JSON.stringify({ path: 'src/main.ts' }) } })
    ].join('\n') + '\n', 'utf8');
    process.env.CODEX_HOME = codexHome;
    const discovered = await discoverSessions('codex', root, 10);
    assert.equal(discovered[0]?.repositoryMatch, true);
    assert.equal(await resolveLatestSession('codex', root, true), rollout);

    const ctx = await createPathContext(root);
    const codex = await parseSession('codex', rollout, ctx);
    assert.ok(codex.events.some(event => event.kind === 'file_read' && event.path === 'src/main.ts'));

    const claudePath = join(root, 'claude.json');
    await writeFile(claudePath, JSON.stringify({ message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'src/main.ts' } }] } }), 'utf8');
    const claude = await parseSession('claude', claudePath, ctx);
    assert.ok(claude.events.some(event => event.kind === 'file_read' && event.path === 'src/main.ts'));

    const openCodePath = join(root, 'opencode.json');
    await writeFile(openCodePath, JSON.stringify({ messages: [{ parts: [{ type: 'tool', name: 'read', state: { status: 'completed', input: { file_path: 'src/main.ts' }, output: 'ok', title: 'read', metadata: {} } }] }] }), 'utf8');
    const opencode = await parseSession('opencode', openCodePath, ctx);
    assert.ok(opencode.events.some(event => event.kind === 'file_read' && event.path === 'src/main.ts'));
  } finally {
    if (oldCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = oldCodexHome;
    await rm(root, { recursive: true, force: true });
    await rm(codexHome, { recursive: true, force: true });
  }
});
