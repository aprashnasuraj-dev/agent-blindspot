import type { NormalizedEvent } from '../../schema/src/index.js';

export type CommandCategory = 'test' | 'build' | 'typecheck' | 'lint' | 'other';
export interface SafeEvidenceObservation {
  seq?: number;
  source: string;
  kind: NormalizedEvent['kind'] | 'coverage_file';
  toolName?: string;
  line?: number;
  label?: string;
}

export function classifyCommand(command: string): CommandCategory {
  const normalized = command.trim().toLowerCase();
  if (/\b(npm|pnpm|yarn)\s+(run\s+)?test\b|\b(vitest|jest|pytest)\b/.test(normalized)) return 'test';
  if (/\b(tsc\b.*--noemit|pyright\b|mypy\b)/.test(normalized)) return 'typecheck';
  if (/\b(npm|pnpm|yarn)\s+(run\s+)?build\b/.test(normalized)) return 'build';
  if (/\b(eslint|ruff|flake8)\b/.test(normalized)) return 'lint';
  return 'other';
}

const MAX_RETAINED_COMMANDS = 1_000;
const MAX_OBSERVATIONS_PER_FILE = 8;

export class EvidenceIndex {
  private readonly inspected = new Set<string>();
  private readonly modified = new Set<string>();
  private readonly covered = new Set<string>();
  private readonly unknown = new Set<string>();
  private readonly observationsByPath = new Map<string, SafeEvidenceObservation[]>();
  private readonly commandsInternal: Array<{ command: string; category: CommandCategory; exitCode?: number }> = [];
  private testsObservedInternal = 0;
  private droppedCommandDetails = 0;

  private retainObservation(path: string, observation: SafeEvidenceObservation): void {
    const current = this.observationsByPath.get(path) ?? [];
    if (current.length < MAX_OBSERVATIONS_PER_FILE) {
      current.push(observation);
      this.observationsByPath.set(path, current);
    }
  }

  ingest(event: NormalizedEvent): void {
    if (event.path) {
      if (event.kind === 'file_read' || event.kind === 'file_search' || event.kind === 'file_write' || event.kind === 'file_patch') {
        this.inspected.add(event.path);
        this.retainObservation(event.path, {
          seq: event.seq,
          source: event.source,
          kind: event.kind,
          ...(event.toolName ? { toolName: event.toolName } : {}),
          ...(event.rawRef?.line !== undefined ? { line: event.rawRef.line } : {})
        });
      }
      if (event.kind === 'file_write' || event.kind === 'file_patch') this.modified.add(event.path);
      if (event.kind === 'coverage_file') {
        this.covered.add(event.path);
        this.retainObservation(event.path, { seq: event.seq, source: event.source, kind: 'coverage_file', label: 'coverage event' });
      }
      if (event.kind === 'unknown') this.unknown.add(event.path);
    }
    if ((event.kind === 'command_end' || event.kind === 'test_result') && event.command) {
      const category = classifyCommand(event.command);
      if (category === 'test') this.testsObservedInternal++;
      if (this.commandsInternal.length < MAX_RETAINED_COMMANDS) {
        this.commandsInternal.push({ command: event.command, category, ...(event.exitCode !== undefined ? { exitCode: event.exitCode } : {}) });
      } else {
        this.droppedCommandDetails++;
      }
    }
  }

  markCovered(path: string, label = 'coverage artifact'): void {
    this.covered.add(path);
    this.retainObservation(path, { source: 'coverage', kind: 'coverage_file', label });
  }
  isInspected(path: string): boolean { return this.inspected.has(path); }
  isModified(path: string): boolean { return this.modified.has(path); }
  isCovered(path: string): boolean { return this.covered.has(path); }
  isUnknown(path: string): boolean { return this.unknown.has(path); }
  observations(path: string): SafeEvidenceObservation[] {
    return [...(this.observationsByPath.get(path) ?? [])].sort((a, b) => (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER) || `${a.kind}\0${a.toolName ?? ''}`.localeCompare(`${b.kind}\0${b.toolName ?? ''}`));
  }
  commands(): Array<{ command: string; category: CommandCategory; exitCode?: number }> {
    return [...this.commandsInternal].sort((a, b) => `${a.command}\0${a.exitCode ?? ''}`.localeCompare(`${b.command}\0${b.exitCode ?? ''}`));
  }
  testCount(): number { return this.testsObservedInternal; }
  droppedCommandDetailCount(): number { return this.droppedCommandDetails; }
}
