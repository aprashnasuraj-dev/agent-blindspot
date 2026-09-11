# AgentBlindspot

> **See what your coding agent never checked.**

AgentBlindspot overlays coding-agent activity on a repository dependency graph to show **potentially affected code with no observed inspection or direct verification evidence**.

**Local. No account. No API key. No second LLM judging the first.**

```bash
npx agent-blindspot . --agent claude --session ./session.json
```

> `npx` becomes the primary install path only after the package is published. Until then, clone the repository and use the development commands below.

## The 20-second example

The checked-in demo changes `src/auth/session.ts` and `src/login.ts`. An unchanged `src/admin/middleware.ts` imports the changed session module, but the sample agent evidence contains no read or direct coverage for it.

```text
CHANGED                 src/auth/session.ts
CHANGED + INSPECTED     src/login.ts
POSSIBLE BLIND SPOT     src/admin/middleware.ts
  reason                imports changed src/auth/session.ts
  relevance             1.00 (direct resolved import)
  agent inspection      not observed
  direct file coverage  not supplied
  test command          observed: pnpm test (exit 0)
```

That is an **attention signal, not proof of a bug**.

Reproduce it:

```bash
npm ci
npm run demo
```

Expected summary: `changed=2 candidates=1 possibleBlindSpots=1 testsObserved=1`.

## What the states mean

| State | Meaning |
|---|---|
| **Changed** | Git reports the file added, modified, deleted, or renamed. |
| **Inspected** | A qualifying tool-level read/search/write/patch observation exists. |
| **Verified direct** | A supplied coverage artifact maps execution to the file. |
| **Possible blind spot** | A structurally impacted candidate is above the relevance threshold with no observed inspection or direct verification. |
| **Unknown** | Adapter, path, graph, or evidence uncertainty prevents a confident classification. |

Passing tests are shown separately from direct file coverage. Agent prose such as “I checked X” is not inspection evidence.

## Current V1 compatibility

| Surface | V1 status | Important boundary |
|---|---|---|
| JavaScript / TypeScript | File/module graph | Common static imports, re-exports, `require()`, and literal dynamic imports; advanced resolver cases may be unknown. |
| Python | File/module graph | Common absolute/relative repository imports; runtime reflection and `sys.path` mutation remain unknown. |
| Codex | JSONL import + best-effort local discovery | Streaming, repository-CWD preference, `--session latest`, oversized-record guard, Base64 redaction; schema mappings are deliberately conservative. |
| Claude Code | Explicit structured JSON / stream-JSON import | Tool-level structured data only; natural-language assertions do not count. |
| OpenCode | Explicit structured export baseline | Official export/server surfaces evolve; unsupported shapes remain unknown. |
| Coverage | LCOV, Istanbul/nyc JSON, coverage.py JSON | Direct file coverage only when paths map into the repository. |

See [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) for exact caveats.

## How analysis works

1. Git identifies the changed files and line ranges.
2. Agent adapters normalize observed tool activity into a vendor-neutral event model.
3. JS/TS and Python import relationships form a deterministic repository graph.
4. Reverse traversal finds files structurally exposed to changed dependencies.
5. Inspection and direct coverage evidence are joined to each candidate; unsupported or ambiguous cases stay unknown.

Default relevance is transparent: direct resolved dependents score `1.00`; deeper candidates decay by `lambda=0.60`, and uncertain edges reduce path confidence.

## Privacy and security

AgentBlindspot is local-first. V1 makes no telemetry or report network calls. Raw transcript prose and binary/Base64 content are not retained by default. Repository paths are canonicalized; paths escaping the repository are rejected. Standalone HTML escapes untrusted strings and uses a CSP with `connect-src 'none'`.

Reports may still reveal repository topology or filenames. Use `--redact-paths` for the repository root and review artifacts before sharing. See [`SECURITY.md`](SECURITY.md).

## Development quick start

Requirements: Node.js 22+ and Git. Node 24 LTS is the primary release baseline; Node 22 compatibility is tested in CI.

```bash
git clone https://github.com/aprashnasuraj-dev/agent-blindspot.git
cd agent-blindspot
npm ci
npm run verify
node dist/apps/cli/src/index.js doctor .
```

## CLI

```text
agent-blindspot analyze [path]
  --agent auto|codex|claude|opencode
  --session <path|latest>
  --base <git-ref>
  --head <git-ref|WORKTREE>
  --coverage <path>
  --depth 1|2|3
  --format html|json|both
  --output <dir>
  --redact-paths
  --strict
  --no-open

agent-blindspot doctor [path]
agent-blindspot adapters
agent-blindspot schema --print
agent-blindspot --version
```

Exit codes: `0` analysis completed; `2` configuration/argument error; `3` no usable diff; `4` requested session cannot be parsed/discovered; `5` analysis completed with strict-mode unsupported evidence; `10` is reserved for internal invariant failure.

## Output

`report.json` is the complete versioned machine contract. `report.html` is a standalone, no-CDN evidence view with expandable per-file dependency reason, inspection observations, direct-verification observations, diagnostics, and command evidence. For very large reports, the HTML initially renders the highest-relevance 1,000 findings and states the truncation explicitly; the complete deterministic finding set remains in `report.json`. This keeps the human view usable without silently discarding analysis data.

## Limitations and counterexample

A fully tested change can still contain a defect outside the modeled graph, while an uninspected dependent can be perfectly safe. File/module dependency analysis also cannot prove runtime behavior. AgentBlindspot therefore reports evidence, inference, and uncertainty rather than converting missing evidence into a defect claim.

Read [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md), [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before using results as a review policy.

## Benchmarks

Targets and actual measurements are separated. Run:

```bash
npm run benchmark
```

Measured release evidence belongs in [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) and must be tied to one exact Git SHA.

## Contributing and roadmap

Small reproducible fixtures are especially valuable: adapter schema samples (redacted), Windows path cases, Python namespace cases, coverage mappings, and resolver counterexamples. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE). The explicit patent grant is useful for a developer-tool project intended for broad open-source reuse.
