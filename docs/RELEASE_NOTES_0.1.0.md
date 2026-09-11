# AgentBlindspot v0.1.0

AgentBlindspot is a local-first evidence analyzer for AI coding workflows. It joins Git changes, repository dependency structure, observed coding-agent tool activity, and optional coverage so reviewers can see potentially affected files with no observed inspection or direct verification evidence.

## What is in 0.1.0

- Deterministic JS/TS and Python file/module dependency graphs.
- Codex, Claude Code, and OpenCode evidence adapters.
- Worktree and commit-range analysis.
- LCOV, Istanbul/nyc JSON, and coverage.py JSON ingestion.
- Explicit changed / inspected / directly verified / possible blind spot / unknown states.
- Standalone JSON and no-CDN HTML reports.
- Large-report bounded rendering while preserving the full machine-readable finding set.
- `doctor`, `adapters`, and `schema` CLI surfaces.
- Reproducible auth-redirect demonstration and deterministic fixtures.
- Cross-platform CI, installed-package smoke, CodeQL/SARIF, performance gates, and real Chromium report smoke.

## The key boundary

A possible blind spot is an **attention signal, not proof of a bug**. An uninspected dependent may be completely safe, and a fully inspected/tested change can still contain a defect outside the modeled graph.

AgentBlindspot reports evidence, inference, and uncertainty separately rather than using missing evidence as a defect verdict.

## Install

```bash
npx agent-blindspot@0.1.0 . --agent claude --session ./session.json
```

Node.js 22+ and Git are required.

## Supply-chain evidence

The release workflow publishes the exact tarball that was smoke-tested in an isolated consumer directory, records its SHA-256 and size, and attaches both the tarball and `package-evidence.json` to this GitHub Release. npm publication happens before the GitHub release/tag is created, so an npm authorization failure cannot produce a false release tag.

## Security and privacy

V1 is local-first and performs no telemetry/report network calls. Raw transcript prose and binary/Base64 content are not retained by default. Repository path escapes are rejected; standalone HTML escapes untrusted strings and uses a restrictive CSP.

See `SECURITY.md`, `docs/EVIDENCE_MODEL.md`, `docs/COMPATIBILITY.md`, and `docs/KNOWN_LIMITATIONS.md` for the exact evidence and trust boundaries.
