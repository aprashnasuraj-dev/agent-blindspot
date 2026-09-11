# AgentBlindspot

> **Your coding agent changed the code. What did it *not* inspect?**

[![CI](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/ci.yml/badge.svg)](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/ci.yml)
[![CodeQL](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/codeql.yml/badge.svg)](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/codeql.yml)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

AgentBlindspot is a **local-first evidence analyzer for AI coding agents**. It joins Git changes, observed agent tool activity, repository dependency structure, and optional coverage data to surface **potentially affected code with no observed inspection or direct verification evidence**.

**Local. Deterministic. No account. No API key. No second LLM judging the first.**

```text
changed → structurally impacted → inspected? → directly verified? → possible blind spot / unknown
```

> A **possible blind spot is an attention signal, not proof of a bug**.

## Quick start

### v0.1.0 CLI — GitHub Release

The first public release is distributed directly from [GitHub Releases](https://github.com/aprashnasuraj-dev/agent-blindspot/releases/tag/v0.1.0). It is **not published to the npm registry**.

Download `agent-blindspot-0.1.0.tgz`, then use the built CLI directly with Node.js 22+ — no registry install is required:

```bash
tar -xzf agent-blindspot-0.1.0.tgz
node package/dist/apps/cli/src/index.js --version
node package/dist/apps/cli/src/index.js analyze . --agent claude --session ./session.json
```

The exact v0.1.0 release is tagged at:

```text
b1014573264feab70cebc198e24e4598a414c65d
```

Release tarball SHA-256:

```text
5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa
```

`SHA256SUMS.txt` and `package-evidence.json` are attached to the same GitHub Release.

If you already use npm as a local package manager, you can optionally install the downloaded file globally without contacting the npm registry:

```bash
npm install -g ./agent-blindspot-0.1.0.tgz
agent-blindspot --version
```

### JSR library distribution

[`@aprashnasuraj-dev/agent-blindspot@0.1.0`](https://jsr.io/@aprashnasuraj-dev/agent-blindspot@0.1.0) is published on JSR through GitHub Actions OIDC. The JSR package is the library/module distribution surface; the CLI remains distributed through the GitHub Release above.

```bash
deno add jsr:@aprashnasuraj-dev/agent-blindspot@0.1.0
```

Direct imports are also supported, including the root analysis API plus `./adapters`, `./evidence`, `./git`, `./graph`, `./report`, and `./schema` exports declared in `jsr.json`.

```ts
import { traverseImpact } from "jsr:@aprashnasuraj-dev/agent-blindspot@0.1.0";
```

For the checked-in reproducible demo:

```bash
git clone https://github.com/aprashnasuraj-dev/agent-blindspot.git
cd agent-blindspot
npm ci
npm run demo
```

Expected summary:

```text
changed=2 candidates=1 possibleBlindSpots=1 testsObserved=1
```

## The 20-second example

The demo changes `src/auth/session.ts` and `src/login.ts`. An unchanged `src/admin/middleware.ts` imports the changed session module, but the sample agent evidence contains no qualifying read or direct file coverage for it.

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

The point is not “the agent made a bug.” The point is: **this file is structurally exposed to the change, and the available evidence does not show that the agent inspected or directly verified it.**

## Why this is different

Most tools cover only one side of the problem. AgentBlindspot deliberately joins the two sides that are usually separate: **what the repository says is connected** and **what the agent evidence says was actually inspected or verified**.

| Approach | Strong at | Missing piece AgentBlindspot focuses on |
|---|---|---|
| AI code reviewer | Producing semantic review judgments | Another model can still miss context or invent confidence; it does not prove what the original agent inspected. |
| Code intelligence / impact graph | Showing callers, imports, dependents, blast radius | Usually does not overlay the coding agent's observed tool activity. |
| Agent observability | Showing sessions, tool calls, tokens, latency, traces | Usually does not convert repository structure into an impacted-but-uninspected file set. |
| Test / coverage tooling | Showing execution evidence | Passing tests and direct file coverage are different from agent inspection and structural impact. |
| **AgentBlindspot** | Joining Git + dependency graph + agent evidence + optional coverage | Intentionally stops at evidence and uncertainty; it does not claim to prove defects. |

This makes AgentBlindspot complementary to tests, static analysis, code review, code intelligence, and agent observability rather than a replacement for them.

## What the states mean

| State | Meaning |
|---|---|
| **Changed** | Git reports the file added, modified, deleted, or renamed. |
| **Inspected** | A qualifying tool-level read/search/write/patch observation exists. |
| **Verified direct** | A supplied coverage artifact maps execution to the file. |
| **Possible blind spot** | A structurally impacted candidate is above the relevance threshold with no observed inspection or direct verification. |
| **Unknown** | Adapter, path, graph, or evidence uncertainty prevents a confident classification. |

Passing tests are shown separately from direct file coverage. Agent prose such as “I checked X” is not treated as inspection evidence.

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

1. **Git** identifies changed files and line ranges.
2. **Agent adapters** normalize observed tool activity into a vendor-neutral evidence model.
3. **JS/TS and Python import relationships** form a deterministic repository graph.
4. **Reverse traversal** finds files structurally exposed to changed dependencies.
5. **Inspection and direct coverage evidence** are joined to each candidate.
6. Unsupported or ambiguous cases stay **unknown** instead of being silently converted into findings.

Default relevance is transparent: direct resolved dependents score `1.00`; deeper candidates decay by `lambda=0.60`, and uncertain edges reduce path confidence.

## Privacy and security

AgentBlindspot is local-first. V1 makes no telemetry or report network calls. Raw transcript prose and binary/Base64 content are not retained by default. Repository paths are canonicalized; paths escaping the repository are rejected. Standalone HTML escapes untrusted strings and uses a CSP with `connect-src 'none'`.

Reports can still reveal repository topology or filenames. Use `--redact-paths` for the repository root and review artifacts before sharing. See [`SECURITY.md`](SECURITY.md).

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

`report.json` is the complete versioned machine contract. `report.html` is a standalone, no-CDN evidence view with expandable per-file dependency reason, inspection observations, direct-verification observations, diagnostics, and command evidence.

For very large reports, the HTML initially renders the highest-relevance 1,000 findings and states the truncation explicitly; the complete deterministic finding set remains in `report.json`. This keeps the human view usable without silently discarding analysis data.

## Development

Requirements: Node.js 22+ and Git. Node 24 is the primary release baseline; Node 22 compatibility is tested in CI.

```bash
npm ci
npm run verify
node dist/apps/cli/src/index.js doctor .
```

The release gates also exercise Linux Node 22/24, macOS Node 24, Windows Node 24, installed-package smoke, a 1 GiB ingestion benchmark, a 10k-file graph benchmark, a 100k-edge traversal benchmark, and a real Chromium 10k-finding report smoke. JSR compatibility is checked separately with a publish dry-run.

## Limitations and counterexample

A fully tested change can still contain a defect outside the modeled graph, while an uninspected dependent can be perfectly safe. File/module dependency analysis also cannot prove runtime behavior. AgentBlindspot therefore reports evidence, inference, and uncertainty rather than converting missing evidence into a defect claim.

Read [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md), [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before using results as a review policy.

## Contributing

The highest-value contributions are small reproducible fixtures: adapter schema samples (redacted), Windows/path alias cases, Python namespace cases, coverage mappings, resolver counterexamples, and additional language graph adapters.

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and the issue templates.

## Launch / share

If the concept is useful, the clearest one-line description is:

> **AgentBlindspot maps what your coding agent changed against what it actually inspected, then surfaces structurally impacted files with missing evidence.**

Release and community-launch copy lives in [`docs/LAUNCH_KIT.md`](docs/LAUNCH_KIT.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE). The license includes an explicit patent grant suitable for broad open-source reuse.
