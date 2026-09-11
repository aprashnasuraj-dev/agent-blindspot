import type { CandidateFinding, DependencyEdge, FileNode } from '../../schema/src/index.js';
import type { EvidenceIndex } from '../../evidence/src/index.js';

export interface AnalysisConfig {
  depth: number;
  lambda: number;
  minEdgeConfidence: number;
  blindspotThreshold: number;
}

interface CandidateState { path: string; root: string; distance: number; pathConfidence: number; relevance: number; dependencyPath: string[]; }

export function traverseImpact(changedPaths: string[], reverse: Map<string, DependencyEdge[]>, config: AnalysisConfig): CandidateState[] {
  const best = new Map<string, CandidateState>();
  const queue: CandidateState[] = changedPaths.map(path => ({ path, root: path, distance: 0, pathConfidence: 1, relevance: 1, dependencyPath: [path] }));
  for (const item of queue) best.set(item.path, item);
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (!current || current.distance >= config.depth) continue;
    for (const edge of reverse.get(current.path) ?? []) {
      if (edge.confidence < config.minEdgeConfidence) continue;
      const distance = current.distance + 1;
      const pathConfidence = current.pathConfidence * edge.confidence;
      const relevance = pathConfidence * Math.pow(config.lambda, Math.max(0, distance - 1));
      if (relevance < config.blindspotThreshold) continue;
      const next: CandidateState = { path: edge.from, root: current.root, distance, pathConfidence, relevance, dependencyPath: [...current.dependencyPath, edge.from] };
      const prev = best.get(next.path);
      const nextKey = `${next.root}\0${next.dependencyPath.join('>')}`;
      const prevKey = prev ? `${prev.root}\0${prev.dependencyPath.join('>')}` : '';
      const improved = !prev || next.relevance > prev.relevance ||
        (next.relevance === prev.relevance && (next.distance < prev.distance || (next.distance === prev.distance && nextKey < prevKey)));
      if (improved) { best.set(next.path, next); queue.push(next); }
    }
  }
  return [...best.values()].sort((a, b) => b.relevance - a.relevance || a.path.localeCompare(b.path));
}

export function classifyCandidates(candidates: CandidateState[], changedFiles: FileNode[], evidence: EvidenceIndex, graphUnknownPaths: Set<string> = new Set<string>()): CandidateFinding[] {
  const changed = new Set(changedFiles.map(f => f.path));
  return candidates.map(c => {
    const inspected = evidence.isInspected(c.path);
    const directlyCovered = evidence.isCovered(c.path);
    const modifiedByAgent = evidence.isModified(c.path);
    const unknown = evidence.isUnknown(c.path) || graphUnknownPaths.has(c.path);
    const states: CandidateFinding['states'] = [];
    if (changed.has(c.path)) states.push('CHANGED');
    if (inspected) states.push('INSPECTED');
    if (modifiedByAgent) states.push('MODIFIED_BY_AGENT');
    if (directlyCovered) states.push('VERIFIED_DIRECT');
    if (unknown) states.push('UNKNOWN');
    if (!changed.has(c.path) && !unknown && !inspected && !directlyCovered) states.push('POSSIBLE_BLIND_SPOT');
    const observations = evidence.observations(c.path);
    const inspectionEvidence = observations
      .filter(item => item.kind === 'file_read' || item.kind === 'file_search' || item.kind === 'file_write' || item.kind === 'file_patch')
      .map(item => `${item.source}:${item.kind}${item.toolName ? ` via ${item.toolName}` : ''}${item.seq !== undefined ? ` (event ${item.seq})` : ''}${item.line !== undefined ? ` line ${item.line}` : ''}`);
    const verificationEvidence = observations
      .filter(item => item.kind === 'coverage_file')
      .map(item => item.label ? `${item.source}:${item.label}` : `${item.source}:coverage_file${item.seq !== undefined ? ` (event ${item.seq})` : ''}`);
    return {
      path: c.path,
      changed: changed.has(c.path),
      inspected,
      modifiedByAgent,
      directlyCovered,
      relevance: Number(c.relevance.toFixed(6)),
      distance: c.distance,
      pathConfidence: Number(c.pathConfidence.toFixed(6)),
      rootChangedPath: c.root,
      dependencyPath: c.dependencyPath,
      states,
      limitations: unknown ? ['Analysis uncertainty prevents a confident blind-spot classification.'] : [],
      evidence: { inspection: inspectionEvidence, verification: verificationEvidence }
    };
  });
}

export function weightedCoverage(findings: CandidateFinding[], predicate: (f: CandidateFinding) => boolean): number | null {
  const classifiable = findings.filter(f => !f.states.includes('UNKNOWN'));
  const denom = classifiable.reduce((s, f) => s + f.relevance, 0);
  if (denom === 0) return null;
  const num = classifiable.filter(predicate).reduce((s, f) => s + f.relevance, 0);
  return Number((num / denom).toFixed(4));
}
