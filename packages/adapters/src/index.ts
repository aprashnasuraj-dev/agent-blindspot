import { createReadStream } from 'node:fs';
import { open, readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { NormalizedEvent, Diagnostic } from '../../schema/src/index.js';
import type { PathContext } from '../../git/src/path.js';
import { normalizeRepoPath } from '../../git/src/path.js';

export type AgentId = 'codex' | 'claude' | 'opencode';
export interface AdapterCapabilities {
  id: AgentId;
  explicitImport: boolean;
  autoDiscovery: 'best-effort' | 'not-v1';
  fileReads: boolean;
  writes: boolean;
  commands: boolean;
  storesRawTranscript: false;
}
export interface ParseResult { events: NormalizedEvent[]; diagnostics: Diagnostic[]; }
export interface ParseStreamResult { events: AsyncIterable<NormalizedEvent>; diagnostics: Diagnostic[]; }
export interface SessionCandidate { path: string; modifiedMs: number; repositoryMatch: boolean; }

const MAX_DISCOVERY_FILES = 5_000;
const DISCOVERY_PROBE_BYTES = 256 * 1024;

export function capabilities(id: AgentId): AdapterCapabilities {
  if (id === 'codex') return { id, explicitImport: true, autoDiscovery: 'best-effort', fileReads: true, writes: true, commands: true, storesRawTranscript: false };
  return { id, explicitImport: true, autoDiscovery: 'not-v1', fileReads: true, writes: true, commands: true, storesRawTranscript: false };
}

const MAX_RECORD = 16 * 1024 * 1024;

function configuredCodexHome(): string {
  const configured = process.env.CODEX_HOME?.trim();
  return configured ? resolve(configured) : join(homedir(), '.codex');
}

async function collectCodexRollouts(root: string): Promise<Array<{ path: string; modifiedMs: number }>> {
  const found: Array<{ path: string; modifiedMs: number }> = [];
  const queue: Array<{ path: string; depth: number }> = [{ path: root, depth: 0 }];
  while (queue.length && found.length < MAX_DISCOVERY_FILES) {
    const current = queue.shift();
    if (!current || current.depth > 5) continue;
    let entries;
    try { entries = await readdir(current.path, { withFileTypes: true }); }
    catch { continue; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const child = join(current.path, entry.name);
      if (entry.isDirectory()) queue.push({ path: child, depth: current.depth + 1 });
      else if (entry.isFile() && /^rollout-.*\.jsonl$/i.test(entry.name)) {
        try {
          const info = await stat(child);
          found.push({ path: child, modifiedMs: info.mtimeMs });
          if (found.length >= MAX_DISCOVERY_FILES) break;
        } catch { /* raced/deleted candidate */ }
      }
    }
  }
  return found;
}

function findRepositoryCwd(value: unknown, depth = 0): string | undefined {
  if (depth > 5 || !value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRepositoryCwd(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  const obj = value as Record<string, unknown>;
  for (const key of ['cwd', 'working_directory', 'workingDirectory', 'repo_root', 'repoRoot']) {
    if (typeof obj[key] === 'string') return String(obj[key]);
  }
  for (const child of Object.values(obj)) {
    const found = findRepositoryCwd(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

async function probeCodexRepositoryMatch(path: string, repositoryRoot: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(path, 'r');
    const buffer = Buffer.allocUnsafe(DISCOVERY_PROBE_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const text = buffer.subarray(0, bytesRead).toString('utf8');
    for (const line of text.split(/\r?\n/).slice(0, 64)) {
      if (!line.trim()) continue;
      try {
        const cwd = findRepositoryCwd(JSON.parse(line) as unknown);
        if (cwd && resolve(cwd) === resolve(repositoryRoot)) return true;
      } catch { /* discovery is best-effort */ }
    }
  } catch { return false; }
  finally { await handle?.close().catch(() => undefined); }
  return false;
}

/** Best-effort Codex rollout discovery. It never reads a rollout wholesale. */
export async function discoverSessions(id: AgentId, repositoryRoot?: string, limit = 20): Promise<SessionCandidate[]> {
  if (id !== 'codex') return [];
  const sessionRoot = join(configuredCodexHome(), 'sessions');
  const raw = await collectCodexRollouts(sessionRoot);
  raw.sort((a, b) => b.modifiedMs - a.modifiedMs || a.path.localeCompare(b.path));
  const probe = raw.slice(0, Math.max(limit * 4, 40));
  const candidates: SessionCandidate[] = [];
  for (const item of probe) {
    const repositoryMatch = repositoryRoot ? await probeCodexRepositoryMatch(item.path, repositoryRoot) : false;
    candidates.push({ ...item, repositoryMatch });
  }
  candidates.sort((a, b) => Number(b.repositoryMatch) - Number(a.repositoryMatch) || b.modifiedMs - a.modifiedMs || a.path.localeCompare(b.path));
  return candidates.slice(0, limit);
}

export async function resolveLatestSession(id: AgentId, repositoryRoot: string, requireRepositoryMatch = false): Promise<string | undefined> {
  const candidates = await discoverSessions(id, repositoryRoot, 20);
  const candidate = requireRepositoryMatch ? candidates.find(item => item.repositoryMatch) : candidates[0];
  return candidate?.path;
}


function eventFromObject(id: AgentId, value: unknown, seq: number, ctx: PathContext, sourceFile: string, line?: number): NormalizedEvent {
  const obj = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const toolName = String(obj.tool_name ?? obj.toolName ?? obj.name ?? obj.type ?? 'unknown');
  const lowerTool = toolName.toLowerCase();
  const input = (obj.input && typeof obj.input === 'object') ? obj.input as Record<string, unknown> : (obj.parameters && typeof obj.parameters === 'object' ? obj.parameters as Record<string, unknown> : obj);
  const rawPathValue = input.path ?? input.file_path ?? input.filePath ?? input.filename ?? input.file;
  const commandValue = input.command ?? input.cmd ?? obj.command;
  const exitValue = obj.exit_code ?? obj.exitCode ?? (obj.result && typeof obj.result === 'object' ? (obj.result as Record<string, unknown>).exitCode : undefined);
  let kind: NormalizedEvent['kind'] = 'unknown';
  if (/read|open|view/.test(lowerTool) && rawPathValue) kind = 'file_read';
  else if (/write|create/.test(lowerTool) && rawPathValue) kind = 'file_write';
  else if (/edit|patch|apply/.test(lowerTool) && rawPathValue) kind = 'file_patch';
  else if (/search|grep|glob/.test(lowerTool) && rawPathValue) kind = 'file_search';
  else if (/shell|bash|command|terminal|exec/.test(lowerTool) || commandValue) kind = 'command_end';
  let path: string | undefined;
  if (typeof rawPathValue === 'string') {
    try { path = normalizeRepoPath(ctx, rawPathValue); } catch { path = undefined; }
  }
  return {
    schemaVersion: 1,
    seq,
    source: id,
    kind,
    ...(path ? { path } : {}),
    ...(typeof rawPathValue === 'string' ? { rawPath: rawPathValue } : {}),
    ...(typeof commandValue === 'string' ? { command: commandValue } : {}),
    ...(typeof exitValue === 'number' ? { exitCode: exitValue } : {}),
    toolName,
    confidence: kind === 'unknown' ? 'unknown' : 'observed',
    adapter: { name: `${id}-structured`, version: '1' },
    rawRef: { file: sourceFile, ...(line !== undefined ? { line } : {}) }
  };
}


function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function toolObjectsFromRecord(id: AgentId, value: unknown): Record<string, unknown>[] {
  const obj = parseJsonObject(value) ?? {};
  const out: Record<string, unknown>[] = [];
  const addToolBlock = (block: unknown): void => {
    const part = parseJsonObject(block);
    if (!part) return;
    const type = String(part.type ?? '').toLowerCase();
    if (type === 'tool_use' || type === 'tool' || part.tool || part.tool_name || part.toolName) {
      const state = parseJsonObject(part.state);
      const nestedInput = state ? parseJsonObject(state.input) ?? state.input : undefined;
      out.push({
        toolName: part.name ?? part.tool ?? part.tool_name ?? part.toolName ?? type,
        input: part.input ?? nestedInput ?? part.parameters ?? {},
        ...(state?.output !== undefined ? { result: state.output } : {}),
        ...(part.exitCode !== undefined ? { exitCode: part.exitCode } : {})
      });
    }
  };

  if (id === 'codex' && obj.payload && typeof obj.payload === 'object') {
    const payload = obj.payload as Record<string, unknown>;
    const payloadType = String(payload.type ?? '').toLowerCase();
    if (payloadType === 'function_call' || payloadType === 'custom_tool_call') {
      const parsedArguments = parseJsonObject(payload.arguments ?? payload.input);
      out.push({
        toolName: payload.name ?? payload.tool_name ?? payloadType,
        input: parsedArguments ?? payload.input ?? payload.arguments ?? {},
        ...(payload.exit_code !== undefined ? { exitCode: payload.exit_code } : {})
      });
    }
  }

  if (id === 'opencode' && Array.isArray(obj.messages)) {
    for (const messageValue of obj.messages) {
      const exportedMessage = parseJsonObject(messageValue);
      if (!exportedMessage || !Array.isArray(exportedMessage.parts)) continue;
      for (const partValue of exportedMessage.parts) {
        const part = parseJsonObject(partValue);
        if (part?.type === 'patch' && Array.isArray(part.files)) {
          for (const file of part.files) if (typeof file === 'string') out.push({ toolName: 'patch', input: { file_path: file } });
        } else {
          addToolBlock(partValue);
        }
      }
    }
  }

  const message = parseJsonObject(obj.message);
  const content = Array.isArray(message?.content) ? message.content : (Array.isArray(obj.content) ? obj.content : undefined);
  if (content) for (const block of content) addToolBlock(block);
  const parts = Array.isArray(obj.parts) ? obj.parts : (Array.isArray(message?.parts) ? message.parts : undefined);
  if (parts) for (const part of parts) addToolBlock(part);

  if (out.length === 0) out.push(obj);
  return out;
}

function tokenizeLiteralCommand(command: string): string[] | null {
  if (/[;&|><$`(){}\\\n\r]/.test(command)) return null;
  const matches = command.match(/"[^"\\]*(?:\\.[^"\\]*)*"|'[^']*'|\S+/g);
  if (!matches) return [];
  return matches.map(token => {
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) return token.slice(1, -1);
    return token;
  });
}

function literalReadPaths(command: string): string[] {
  const tokens = tokenizeLiteralCommand(command);
  if (!tokens?.length) return [];
  const executable = tokens[0]?.replace(/^.*[\\/]/, '').toLowerCase();
  if (!['cat', 'head', 'tail', 'sed'].includes(executable ?? '')) return [];
  if (executable === 'sed') {
    const candidate = [...tokens.slice(1)].reverse().find(token => !token.startsWith('-') && !/^\d/.test(token) && !token.includes('/'));
    return candidate ? [candidate] : [];
  }
  return tokens.slice(1).filter(token => !token.startsWith('-') && !/^\d+$/.test(token));
}

function patchPaths(input: unknown): string[] {
  const obj = parseJsonObject(input);
  const text = typeof input === 'string' ? input : [obj?.patch, obj?.text, obj?.content].find(v => typeof v === 'string');
  if (typeof text !== 'string') return [];
  const found = new Set<string>();
  for (const match of text.matchAll(/^\*\*\* (?:Update|Add|Delete) File:\s*(.+)$/gm)) found.add(match[1]!.trim());
  for (const match of text.matchAll(/^\+\+\+ b\/(.+)$/gm)) found.add(match[1]!.trim());
  return [...found].sort();
}

function eventsFromRecord(id: AgentId, value: unknown, startSeq: number, ctx: PathContext, sourceFile: string, line?: number): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  let seq = startSeq;
  for (const toolObj of toolObjectsFromRecord(id, value)) {
    const event = eventFromObject(id, toolObj, ++seq, ctx, sourceFile, line);
    events.push(event);
    if (event.command) {
      for (const rawPath of literalReadPaths(event.command)) {
        try {
          const path = normalizeRepoPath(ctx, rawPath);
          events.push({ schemaVersion: 1, seq: ++seq, source: id, kind: 'file_read', path, rawPath, toolName: 'shell-literal-read', confidence: 'observed', adapter: { name: `${id}-structured`, version: '1' }, rawRef: { file: sourceFile, ...(line !== undefined ? { line } : {}) } });
        } catch { /* escaped/non-repository command path is not inspection evidence */ }
      }
    }
    const input = toolObj.input ?? toolObj.parameters;
    if (/patch|apply/i.test(String(toolObj.toolName ?? toolObj.name ?? ''))) {
      for (const rawPath of patchPaths(input)) {
        try {
          const path = normalizeRepoPath(ctx, rawPath);
          events.push({ schemaVersion: 1, seq: ++seq, source: id, kind: 'file_patch', path, rawPath, toolName: String(toolObj.toolName ?? 'patch'), confidence: 'observed', adapter: { name: `${id}-structured`, version: '1' }, rawRef: { file: sourceFile, ...(line !== undefined ? { line } : {}) } });
        } catch { /* rejected path */ }
      }
    }
  }
  return events;
}

function scrubLargeBinary(text: string): string {
  return text.replace(/data:[^;"']+;base64,[A-Za-z0-9+/=]{1024,}/g, 'data:application/octet-stream;base64,[REDACTED]');
}

async function* boundedLines(path: string): AsyncGenerator<{ line: string; oversized: boolean; lineNo: number }> {
  const stream = createReadStream(path, { encoding: 'utf8', highWaterMark: 64 * 1024 });
  let buffer = '';
  let oversized = false;
  let lineNo = 0;
  for await (const chunkValue of stream) {
    let chunk = String(chunkValue);
    while (chunk.length) {
      const newline = chunk.indexOf('\n');
      const part = newline >= 0 ? chunk.slice(0, newline) : chunk;
      if (!oversized) {
        if (buffer.length + part.length > MAX_RECORD) {
          buffer = '';
          oversized = true;
        } else {
          buffer += part;
        }
      }
      if (newline < 0) break;
      lineNo++;
      yield { line: buffer.replace(/\r$/, ''), oversized, lineNo };
      buffer = '';
      oversized = false;
      chunk = chunk.slice(newline + 1);
    }
  }
  if (buffer.length || oversized) {
    lineNo++;
    yield { line: buffer.replace(/\r$/, ''), oversized, lineNo };
  }
}

export function streamSession(id: AgentId, inputPath: string, ctx: PathContext, strict = false): ParseStreamResult {
  const diagnostics: Diagnostic[] = [];
  async function* events(): AsyncGenerator<NormalizedEvent> {
    let seq = 0;
    if (id === 'codex' || inputPath.endsWith('.jsonl') || inputPath.endsWith('.ndjson')) {
      for await (const record of boundedLines(inputPath)) {
        if (record.oversized) {
          diagnostics.push({ code: 'ADP002', severity: strict ? 'error' : 'warning', subsystem: 'adapter', message: `Oversized record skipped at line ${record.lineNo}` });
          continue;
        }
        const rawLine = record.line;
        if (!rawLine.trim()) continue;
        try {
          const mapped = eventsFromRecord(id, JSON.parse(scrubLargeBinary(rawLine)), seq, ctx, inputPath, record.lineNo);
          for (const event of mapped) { seq = event.seq; yield event; }
        } catch {
          diagnostics.push({ code: 'ADP001', severity: strict ? 'error' : 'warning', subsystem: 'adapter', message: `Unrecognized/malformed event skipped at line ${record.lineNo}` });
        }
      }
      return;
    }
    const text = await readFile(inputPath, 'utf8');
    if (text.length > MAX_RECORD * 4) throw new Error('Structured session file too large for non-stream JSON import');
    const data = JSON.parse(scrubLargeBinary(text)) as unknown;
    const list = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).events) ? (data as Record<string, unknown>).events as unknown[] : [data]);
    for (const value of list) {
      const mapped = eventsFromRecord(id, value, seq, ctx, inputPath);
      for (const event of mapped) { seq = event.seq; yield event; }
    }
  }
  return { events: events(), diagnostics };
}

/**
 * Convenience collector for bounded fixtures and callers that explicitly need an array.
 * Production CLI analysis uses streamSession() to keep session memory bounded.
 */
export async function parseSession(id: AgentId, inputPath: string, ctx: PathContext, strict = false, maxCollectedEvents = 100_000): Promise<ParseResult> {
  const streamed = streamSession(id, inputPath, ctx, strict);
  const events: NormalizedEvent[] = [];
  for await (const event of streamed.events) {
    if (events.length >= maxCollectedEvents) throw new Error(`Adapter event collection exceeded ${maxCollectedEvents}; use streamSession() for large sessions`);
    events.push(event);
  }
  return { events, diagnostics: streamed.diagnostics };
}
