# Architecture

AgentBlindspot is a local-first deterministic evidence pipeline:

`repository + agent session + optional coverage -> Git diff + static graph + normalized evidence -> reverse impact traversal -> evidence join -> report.json + report.html`

## Boundaries

- `apps/cli`: orchestration and CLI exit contracts.
- `packages/adapters`: vendor-specific Codex, Claude Code, and OpenCode structures normalized into `NormalizedEvent`.
- `packages/git`: repository discovery, path identity, diff, rename/delete, binary and submodule metadata.
- `packages/graph`: JS/TS and Python file/module dependency resolution.
- `packages/evidence`: inspection, command, and coverage evidence.
- `packages/core`: deterministic traversal, relevance, and possible-blind-spot classification.
- `packages/report`: versioned JSON model and standalone HTML.
- `packages/schema`: shared stable data contracts.

## Invariants

1. Vendor schemas do not escape the adapter boundary.
2. Missing evidence means **not observed**, never **did not happen**.
3. All path identity is repository-relative after canonicalization.
4. Session JSONL is processed incrementally; raw transcript prose and binary payloads are not retained by default.
5. Test-command success is distinct from direct file-level coverage.
6. Identical semantic input produces deterministic findings and report ordering.
7. Untrusted filenames and metadata are escaped before HTML output.
8. Transcript commands are parsed conservatively and never executed.

Edge direction is `A -> B` = A depends on B. Impact analysis walks reverse edges from changed B to potentially exposed A.
