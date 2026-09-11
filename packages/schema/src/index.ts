export type EvidenceSource = 'codex' | 'claude' | 'opencode' | 'coverage' | 'git';
export type EventKind =
  | 'session_meta'
  | 'file_read'
  | 'file_write'
  | 'file_patch'
  | 'file_search'
  | 'command_start'
  | 'command_end'
  | 'test_result'
  | 'coverage_file'
  | 'unknown';
export type EvidenceConfidence = 'observed' | 'inferred' | 'unknown';

export interface NormalizedEvent {
  schemaVersion: 1;
  seq: number;
  ts?: string;
  source: EvidenceSource;
  kind: EventKind;
  path?: string;
  rawPath?: string;
  command?: string;
  exitCode?: number;
  toolName?: string;
  confidence: EvidenceConfidence;
  adapter: { name: string; version: string; vendorVersion?: string };
  rawRef?: { file?: string; line?: number; eventId?: string };
  meta?: Record<string, string | number | boolean | null>;
}

export type FileStatus = 'unchanged' | 'added' | 'modified' | 'deleted' | 'renamed';
export interface FileNode {
  id: string;
  path: string;
  language: string;
  status: FileStatus;
  oldPath?: string;
  changedRanges?: Array<{ start: number; end: number }>;
  parseStatus: 'ok' | 'partial' | 'unsupported' | 'error';
  binary?: boolean;
  submodule?: boolean;
  generated?: boolean;
}

export type DependencyKind = 'import' | 'reexport' | 'require' | 'dynamic-import' | 'package';
export interface DependencyEdge {
  from: string;
  to: string;
  kind: DependencyKind;
  confidence: number;
  evidence: { file: string; line?: number; specifier: string };
}

export interface Diagnostic {
  code: string;
  severity: 'info' | 'warning' | 'error';
  subsystem: 'adapter' | 'git' | 'graph' | 'coverage' | 'report' | 'security';
  message: string;
  remediation?: string;
  count?: number;
}

export interface CandidateFinding {
  path: string;
  changed: boolean;
  inspected: boolean;
  modifiedByAgent: boolean;
  directlyCovered: boolean;
  relevance: number;
  distance: number;
  pathConfidence: number;
  rootChangedPath: string;
  dependencyPath: string[];
  states: Array<'CHANGED' | 'INSPECTED' | 'MODIFIED_BY_AGENT' | 'VERIFIED_DIRECT' | 'POSSIBLE_BLIND_SPOT' | 'UNKNOWN'>;
  limitations: string[];
  evidence?: { inspection: string[]; verification: string[] };
}

export interface ReportModel {
  reportSchemaVersion: 1;
  tool: { name: 'AgentBlindspot'; version: string };
  repository: { root: string; base: string; head: string };
  generatedAt: string;
  effectiveConfig: {
    depth: number;
    lambda: number;
    minEdgeConfidence: number;
    blindspotThreshold: number;
    redactPaths: boolean;
  };
  summary: {
    changedFiles: number;
    candidateImpactedFiles: number;
    possibleBlindSpots: number;
    inspectionCoverage: number | null;
    directVerificationCoverage: number | null;
    testsObserved: number;
  };
  findings: CandidateFinding[];
  commands: Array<{ command: string; category: string; exitCode?: number }>;
  diagnostics: Diagnostic[];
  limitations: string[];
}

export function isNormalizedEvent(value: unknown): value is NormalizedEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.schemaVersion === 1 && typeof v.seq === 'number' && typeof v.source === 'string' && typeof v.kind === 'string' && typeof v.confidence === 'string';
}
