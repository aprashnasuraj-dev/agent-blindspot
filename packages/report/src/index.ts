import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CandidateFinding, Diagnostic, ReportModel } from '../../schema/src/index.js';
import type { EvidenceIndex } from '../../evidence/src/index.js';
import { weightedCoverage } from '../../core/src/index.js';

export function buildReport(params: {
  version: string;
  root: string;
  base: string;
  head: string;
  config: ReportModel['effectiveConfig'];
  findings: CandidateFinding[];
  evidence: EvidenceIndex;
  diagnostics: Diagnostic[];
  limitations: string[];
  generatedAt?: string;
}): ReportModel {
  const findings = [...params.findings].sort((a, b) => b.relevance - a.relevance || a.path.localeCompare(b.path));
  return {
    reportSchemaVersion: 1,
    tool: { name: 'AgentBlindspot', version: params.version },
    repository: { root: params.config.redactPaths ? '[REDACTED]' : params.root, base: params.base, head: params.head },
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    effectiveConfig: params.config,
    summary: {
      changedFiles: findings.filter(f => f.changed).length,
      candidateImpactedFiles: findings.filter(f => !f.changed).length,
      possibleBlindSpots: findings.filter(f => f.states.includes('POSSIBLE_BLIND_SPOT')).length,
      inspectionCoverage: weightedCoverage(findings, f => f.inspected),
      directVerificationCoverage: weightedCoverage(findings, f => f.directlyCovered),
      testsObserved: params.evidence.testCount()
    },
    findings,
    commands: params.evidence.commands(),
    diagnostics: [...params.diagnostics].sort((a, b) => `${a.code}\0${a.message}`.localeCompare(`${b.code}\0${b.message}`)),
    limitations: [...new Set(params.limitations)].sort()
  };
}

export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function pct(value: number | null): string { return value === null ? 'unknown' : `${Math.round(value * 100)}%`; }

export function renderHtml(report: ReportModel): string {
  const rows = report.findings.map(f => {
    const inspection = f.evidence?.inspection.length
      ? f.evidence.inspection.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>No qualifying inspection evidence observed.</li>';
    const verification = f.evidence?.verification.length
      ? f.evidence.verification.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>No direct file-level coverage evidence supplied.</li>';
    const limitations = f.limitations.length ? f.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('') : '<li>None recorded for this finding.</li>';
    const interpretation = f.states.includes('POSSIBLE_BLIND_SPOT')
      ? 'Structurally exposed to a changed file. No qualifying inspection or direct file-level verification was observed. This is not proof of a defect.'
      : f.states.includes('UNKNOWN')
        ? 'Available evidence is insufficient for a confident blind-spot classification.'
        : 'Evidence state shown below; component evidence is not proof of system correctness.';
    return `<tr><td><code>${escapeHtml(f.path)}</code></td><td>${escapeHtml(f.states.join(', ') || 'candidate')}</td><td>${f.relevance.toFixed(2)}</td><td>${f.distance}</td><td>${f.pathConfidence.toFixed(2)}</td><td><details><summary>Evidence</summary><p><b>Reason:</b> ${escapeHtml(f.dependencyPath.join(' → '))}</p><p><b>Interpretation:</b> ${escapeHtml(interpretation)}</p><b>Inspection observations</b><ul>${inspection}</ul><b>Direct verification observations</b><ul>${verification}</ul><b>Finding limitations</b><ul>${limitations}</ul></details></td></tr>`;
  }).join('');
  const limitations = report.limitations.map(l => `<li>${escapeHtml(l)}</li>`).join('');
  const commands = report.commands.length
    ? report.commands.map(c => `<tr><td><code>${escapeHtml(c.command)}</code></td><td>${escapeHtml(c.category)}</td><td>${c.exitCode ?? 'unknown'}</td></tr>`).join('')
    : '<tr><td colspan="3">No qualifying command evidence retained.</td></tr>';
  const diagnostics = report.diagnostics.length
    ? report.diagnostics.map(d => `<tr><td>${escapeHtml(d.code)}</td><td>${escapeHtml(d.severity)}</td><td>${escapeHtml(d.subsystem)}</td><td>${escapeHtml(d.message)}</td></tr>`).join('')
    : '<tr><td colspan="4">No diagnostics.</td></tr>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'">
<title>AgentBlindspot report</title><style>body{font-family:system-ui,sans-serif;margin:2rem;max-width:1400px}header{display:flex;gap:1rem;flex-wrap:wrap}.card{border:1px solid #bbb;border-radius:8px;padding:.8rem;min-width:150px}table{border-collapse:collapse;width:100%;margin-top:1rem;table-layout:auto}th,td{border-bottom:1px solid #ddd;padding:.6rem;text-align:left;vertical-align:top}.warn{background:#fff4d6;padding:1rem;border-radius:8px}code{background:#f4f4f4;padding:.1rem .3rem;overflow-wrap:anywhere}details{max-width:58rem}summary{cursor:pointer;font-weight:600}.muted{color:#555}</style></head>
<body><h1>AgentBlindspot</h1><p>Evidence view for possible coding-agent blind spots. Absence of evidence is not proof of failure.</p>
<header><div class="card"><b>Changed</b><br>${report.summary.changedFiles}</div><div class="card"><b>Candidates</b><br>${report.summary.candidateImpactedFiles}</div><div class="card"><b>Possible blind spots</b><br>${report.summary.possibleBlindSpots}</div><div class="card"><b>Inspection coverage</b><br>${pct(report.summary.inspectionCoverage)}</div><div class="card"><b>Direct verification</b><br>${pct(report.summary.directVerificationCoverage)}</div><div class="card"><b>Tests observed</b><br>${report.summary.testsObserved}</div></header>
${report.limitations.length ? `<section class="warn"><b>Limitations / unknowns</b><ul>${limitations}</ul></section>` : ''}
<h2>Impact list</h2><p class="muted">Expand Evidence to see the deterministic dependency reason, observed inspection/coverage evidence, and uncertainty boundary.</p><table><thead><tr><th>File</th><th>Evidence state</th><th>Relevance</th><th>Distance</th><th>Path confidence</th><th>Evidence detail</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Observed commands</h2><table><thead><tr><th>Command</th><th>Category</th><th>Exit code</th></tr></thead><tbody>${commands}</tbody></table>
<h2>Diagnostics</h2><table><thead><tr><th>Code</th><th>Severity</th><th>Subsystem</th><th>Message</th></tr></thead><tbody>${diagnostics}</tbody></table>
</body></html>`;
}

export async function writeReport(outputDir: string, report: ReportModel, format: 'html' | 'json' | 'both' = 'both'): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  if (format === 'json' || format === 'both') await writeFile(join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (format === 'html' || format === 'both') await writeFile(join(outputDir, 'report.html'), renderHtml(report), 'utf8');
}
