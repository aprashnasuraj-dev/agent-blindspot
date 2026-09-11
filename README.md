# AgentBlindspot

## Your coding agent changed the code. What did it *not* inspect?

[![CI](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/ci.yml/badge.svg)](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/ci.yml)
[![CodeQL](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/codeql.yml/badge.svg)](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/workflows/codeql.yml)
[![GitHub Release](https://img.shields.io/github/v/release/aprashnasuraj-dev/agent-blindspot?display_name=tag)](https://github.com/aprashnasuraj-dev/agent-blindspot/releases/tag/v0.1.0)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)

**AgentBlindspot is a local-first evidence analyzer for AI coding workflows.** It overlays the Git diff, repository dependency structure, observed coding-agent tool activity, and optional coverage to surface **structurally impacted files with no observed inspection or direct verification evidence**.

**Local-first. Deterministic. Zero runtime dependencies. No account. No API key. No second LLM judging the first.**

> A coding-agent session is chronological. Software dependencies are structural. A run can look thorough, tests can pass, and an unchanged dependent can still sit completely outside the agent's observed inspection path.

AgentBlindspot exists to make that gap visible.

**[Try the demo](#see-the-blind-spot-in-20-seconds) · [Get the CLI](#quick-start) · [Use the JSR library](#jsr-library) · [Read the evidence model](docs/EVIDENCE_MODEL.md) · [Contribute](#contributing)**

---

## See the blind spot in 20 seconds

Imagine an agent changes authentication code and a login route. Tests pass. The diff looks reasonable.

But an unchanged admin middleware file imports the changed session module, and the available agent evidence never shows that file being read, searched, patched, or directly covered.

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

That does **not** mean the middleware contains a bug. It means something more precise:

> **This file is structurally exposed to the change, but the available evidence does not show that the coding agent inspected or directly verified it.**

Run the exact checked-in demo:

```bash
git clone https://github.com/aprashnasuraj-dev/agent-blindspot.git
cd agent-blindspot
npm ci
npm run demo
```

Expected summary:

```text
changed=2 candidates=1 possibleBlindSpots=1 testsObserved=1
finding=src/admin/middleware.ts state=POSSIBLE_BLIND_SPOT relevance=1
```

This is the entire idea in one line:

```text
changed → structurally impacted → inspected? → directly verified? → possible blind spot / unknown
```

---

## Why this matters

Coding agents are increasingly good at making coherent changes. The harder review question is often not **“Did the agent explain its patch?”** but **“What relevant code never entered the agent's working set?”**

Tests, code review, code intelligence, coverage, and agent observability each answer a different part of that question. AgentBlindspot joins the evidence surfaces instead of asking another model to guess.

| Evidence surface | What AgentBlindspot asks |
|---|---|
| **Git diff** | What actually changed? |
| **Dependency graph** | What else is structurally exposed to those changes? |
| **Agent tool evidence** | Which files did the agent demonstrably read, search, write, or patch? |
| **Coverage** | Which files have direct execution evidence? |
| **Diagnostics / unknowns** | Where is the evidence too ambiguous to classify safely? |

The output is designed for **review prioritization**, not defect prediction.

---

## Quick start

### CLI from the GitHub Release

The authoritative `v0.1.0` CLI artifact is distributed through [GitHub Releases](https://github.com/aprashnasuraj-dev/agent-blindspot/releases/tag/v0.1.0). It is **not published to the npm registry**.

If Node.js 22+ is installed, the fastest global install is the exact GitHub-hosted tarball:

```bash
npm install -g https://github.com/aprashnasuraj-dev/agent-blindspot/releases/download/v0.1.0/agent-blindspot-0.1.0.tgz
agent-blindspot --version
```

That command uses npm only as the local package installer; the package is downloaded from GitHub, not from the npm registry.

Prefer no global install? Download `agent-blindspot-0.1.0.tgz`, extract it, and run the built CLI directly:

```bash
tar -xzf agent-blindspot-0.1.0.tgz
node package/dist/apps/cli/src/index.js --version
```

A typical analysis looks like:

```bash
agent-blindspot doctor .
agent-blindspot analyze . --agent codex --session latest --format both
```

For Claude Code or OpenCode structured exports, pass the session/export path explicitly:

```bash
agent-blindspot analyze . --agent claude --session ./session.json --format both
```

Outputs:

```text
report.json   complete versioned machine-readable evidence
report.html   standalone no-CDN review UI
```

### JSR library

The reusable library/module surface is published as [`@aprashnasuraj-dev/agent-blindspot@0.1.0`](https://jsr.io/@aprashnasuraj-dev/agent-blindspot@0.1.0).

```bash
deno add jsr:@aprashnasuraj-dev/agent-blindspot@0.1.0
```

Example:

```ts
import { traverseImpact } from "jsr:@aprashnasuraj-dev/agent-blindspot@0.1.0";
```

The JSR package exposes the root analysis API plus:

```text
./adapters
./evidence
./git
./graph
./report
./schema
```

Use the JSR package for library integration; use the GitHub Release for the packaged CLI.

---

## What you get

| Capability | What it provides |
|---|---|
| **Change awareness** | Worktree and commit-range Git diffs with canonical repository paths and line ranges. |
| **Structural impact** | Deterministic JS/TS and Python reverse dependency traversal. |
| **Agent evidence** | Conservative Codex, Claude Code, and OpenCode tool-level evidence adapters. |
| **Direct verification** | LCOV, Istanbul/nyc JSON, and coverage.py JSON file mapping. |
| **Explicit uncertainty** | Unsupported or ambiguous evidence stays `UNKNOWN` instead of becoming a false finding. |
| **Reviewable output** | Complete JSON plus standalone HTML with dependency reason, evidence detail, diagnostics, and command observations. |
| **Local-first operation** | No telemetry/report network calls in V1; no account or external model required. |

### The five evidence states

| State | Meaning |
|---|---|
| **CHANGED** | Git reports the file added, modified, deleted, or renamed. |
| **INSPECTED** | A qualifying tool-level read/search/write/patch observation exists. |
| **VERIFIED_DIRECT** | A supplied coverage artifact maps execution directly to the file. |
| **POSSIBLE_BLIND_SPOT** | A structurally impacted candidate is above the relevance threshold with no observed inspection or direct verification. |
| **UNKNOWN** | Adapter, path, graph, or evidence uncertainty prevents a confident classification. |

Two boundaries are deliberate:

- **Passing tests are not direct file coverage.** Test-command success is recorded separately.
- **Agent prose is not inspection evidence.** “I checked this file” does not count unless tool-level evidence supports it.

---

## Why not just use an AI reviewer, tests, or code intelligence?

Because they answer different questions.

| Approach | Strong at | What can still be missing |
|---|---|---|
| AI code reviewer | Semantic review judgments | Another model can miss context or invent confidence; it still does not prove what the original agent inspected. |
| Code intelligence / impact graph | Callers, imports, dependents, blast radius | Usually does not overlay what the coding agent actually touched or inspected. |
| Agent observability | Sessions, tool calls, tokens, traces, latency | Usually does not translate repository structure into an impacted-but-uninspected file set. |
| Tests / coverage | Execution evidence | Passing tests do not establish agent inspection; command success is not file coverage. |
| **AgentBlindspot** | Joining Git + structure + agent evidence + optional coverage | Intentionally stops at evidence and uncertainty instead of claiming to prove defects. |

AgentBlindspot is complementary to tests, static analysis, AI review, code intelligence, and observability—not a replacement for them.

---

## How it works

1. **Git** identifies changed files and line ranges.
2. **Agent adapters** normalize observed tool activity into a vendor-neutral evidence model.
3. **JS/TS and Python imports** form a deterministic repository graph.
4. **Reverse traversal** finds files structurally exposed to changed dependencies.
5. **Inspection and direct coverage evidence** are joined to each candidate.
6. **Uncertainty stays visible** instead of being silently converted into a finding.

Default relevance is intentionally transparent: direct resolved dependents score `1.00`; deeper candidates decay by `lambda=0.60`, while uncertain edges reduce path confidence.

The result is not “AI confidence.” It is an auditable chain of evidence.

---

## Supported today

| Surface | V1 support | Important boundary |
|---|---|---|
| **JavaScript / TypeScript** | File/module graph | Common static imports, re-exports, `require()`, and literal dynamic imports; advanced resolver cases may remain unknown. |
| **Python** | File/module graph | Common absolute/relative repository imports; runtime reflection and `sys.path` mutation remain unknown. |
| **Codex** | JSONL import + best-effort local discovery | Streaming, repository-CWD preference, `--session latest`, oversized-record guard, Base64 redaction; mappings are conservative. |
| **Claude Code** | Explicit structured JSON / stream-JSON import | Tool-level structured data only; natural-language assertions do not count as inspection. |
| **OpenCode** | Explicit structured export baseline | Unsupported or evolving shapes remain unknown rather than guessed. |
| **Coverage** | LCOV, Istanbul/nyc JSON, coverage.py JSON | Direct verification only when paths map safely into the repository. |

See [`docs/COMPATIBILITY.md`](docs/COMPATIBILITY.md) for the exact resolver and adapter boundaries.

---

## Reports that can be inspected, not merely trusted

`report.json` is the complete versioned machine contract. `report.html` is a standalone, no-CDN evidence view with expandable per-file details for:

- dependency reason and path;
- structural distance and relevance;
- observed inspection evidence;
- direct verification evidence;
- command observations;
- diagnostics and limitations.

For very large results, the HTML initially renders the highest-relevance 1,000 findings and explicitly says that the human view is bounded. The complete deterministic finding set remains in `report.json`.

That distinction is intentional: **UI performance should never silently discard analysis data.**

---

## Privacy and security

AgentBlindspot is local-first by design.

- No telemetry or report network calls in V1.
- No external model/API is required.
- Raw transcript prose and binary/Base64 content are not retained by default.
- Repository paths are canonicalized; paths escaping the repository are rejected.
- Standalone HTML escapes untrusted strings and uses a restrictive CSP with `connect-src 'none'`.
- Reports can still reveal filenames and repository topology; use `--redact-paths` and review artifacts before sharing them.

See [`SECURITY.md`](SECURITY.md) for the threat model and [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md) for what each evidence class does—and does not—prove.

### Release and provenance

The GitHub CLI release and the JSR library publication are deliberately separate surfaces.

**GitHub `v0.1.0` CLI release**

```text
source commit   b1014573264feab70cebc198e24e4598a414c65d
artifact        agent-blindspot-0.1.0.tgz
size            45,998 bytes
SHA-256         5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa
```

`SHA256SUMS.txt` and `package-evidence.json` are attached to the same [GitHub Release](https://github.com/aprashnasuraj-dev/agent-blindspot/releases/tag/v0.1.0).

**JSR `0.1.0` library publication**

```text
package         @aprashnasuraj-dev/agent-blindspot@0.1.0
source commit   89e0252e7a60f8d13219630f85e0c8ef6061a9c9
auth            GitHub Actions OIDC
provenance      Sigstore transparency log index 2791733344
```

The JSR publish workflow used tokenless GitHub OIDC and emitted provenance. See the [successful publish workflow](https://github.com/aprashnasuraj-dev/agent-blindspot/actions/runs/34579647764).

---

## Release gates

The release pipeline is intentionally heavier than the runtime package. Hosted validation exercises:

- Linux Node 22 and Node 24;
- macOS Node 24;
- Windows Node 24;
- installed-package smoke testing;
- runtime dependency audit;
- a **1 GiB** session-ingestion benchmark;
- a **10k-file** graph benchmark;
- a **100k-edge** impact traversal benchmark;
- a **10k-finding** standalone report render;
- a real Chromium browser smoke test;
- CodeQL JavaScript/TypeScript analysis with SARIF upload;
- JSR publish dry-run validation.

These are release gates, not universal performance guarantees. They exist to make regressions visible before publication.

---

## CLI reference

<details>
<summary><strong>Show full CLI surface</strong></summary>

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

Exit codes:

```text
0   analysis completed
2   configuration / argument error
3   no usable diff
4   requested session cannot be parsed or discovered
5   analysis completed with strict-mode unsupported evidence
10  internal invariant failure
```

</details>

---

## What AgentBlindspot intentionally does *not* claim

A possible blind spot is **not** a proven bug, vulnerability, or bad patch.

An uninspected dependent can be perfectly safe. A fully inspected and well-tested change can still contain a defect outside the modeled graph. File/module dependency analysis also cannot prove runtime behavior.

That is why AgentBlindspot keeps **evidence**, **inference**, and **uncertainty** separate.

Read [`docs/KNOWN_LIMITATIONS.md`](docs/KNOWN_LIMITATIONS.md), [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md), and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) before turning findings into review policy.

---

## Development

Requirements: Node.js 22+ and Git. Node 24 is the primary release baseline; Node 22 compatibility is continuously tested.

```bash
npm ci
npm run verify
node dist/apps/cli/src/index.js doctor .
```

Useful commands:

```bash
npm run typecheck
npm test
npm run demo
npm run benchmark
npm run browser:smoke
npm run package:smoke
```

The package has **zero runtime dependencies**; TypeScript and Node types are development-only dependencies.

---

## Contributing

The highest-value contributions are small, reproducible counterexamples: cases where the graph, adapter, evidence model, path handling, or coverage mapping is wrong or incomplete.

Good places to jump in:

- [#3 — GitHub Copilot CLI evidence fixture + conservative adapter mapping](https://github.com/aprashnasuraj-dev/agent-blindspot/issues/3)
- [#4 — deterministic Go import graph support](https://github.com/aprashnasuraj-dev/agent-blindspot/issues/4)
- [#5 — SARIF / pull-request annotations without changing evidence semantics](https://github.com/aprashnasuraj-dev/agent-blindspot/issues/5)
- [#6 — reproducible standalone Windows/macOS/Linux CLI binaries](https://github.com/aprashnasuraj-dev/agent-blindspot/issues/6)

Also valuable: redacted adapter schema samples, Windows path cases, Python namespace cases, resolver counterexamples, and coverage mapping fixtures.

See [`CONTRIBUTING.md`](CONTRIBUTING.md), [`docs/ROADMAP.md`](docs/ROADMAP.md), and the issue templates.

If AgentBlindspot catches a real blind spot—or produces a wrong one—the most useful contribution is a **minimal reproducible fixture**. That improves the evidence model for everyone.

---

## Share the idea

The shortest accurate description is:

> **AgentBlindspot maps what your coding agent changed against what it actually inspected, then surfaces structurally impacted files with missing evidence.**

Or even shorter:

> **Tests can pass. The diff can look clean. What relevant code did your coding agent never inspect?**

If that question resonates, star the repository, try the 20-second demo, and send the smallest counterexample you can find.

Community-specific launch copy lives in [`docs/LAUNCH_KIT.md`](docs/LAUNCH_KIT.md).

---

## License

Apache-2.0. See [`LICENSE`](LICENSE). The license includes an explicit patent grant suitable for broad open-source reuse.
