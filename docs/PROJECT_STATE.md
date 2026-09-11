# Project state

## Product

AgentBlindspot is a local-first evidence analyzer that joins Git changes, coding-agent tool activity, repository dependency structure, and optional coverage to surface **possible blind spots** without converting missing evidence into defect claims.

## Authoritative repository

`aprashnasuraj-dev/agent-blindspot`, default branch `main`.

## Current release line

`0.1.0` public-preview candidate. The exact candidate SHA is established only after the complete tree is committed and all hosted gates are green on that same SHA.

## Completed scope

- Git/path identity and worktree/commit-range diff handling.
- JS/TS + Python dependency graph.
- Normalized evidence and bounded agent adapters.
- LCOV / coverage.py / Istanbul path ingestion.
- Impact traversal, relevance, possible-blind-spot and unknown states.
- Standalone JSON/HTML report with safe evidence detail.
- Doctor/adapters/schema CLI surfaces.
- Security, deterministic fixtures, demo, package smoke, benchmark harness, CI and CodeQL workflows.

## Release blockers

Hosted CI, full benchmark, browser-scale smoke, package hash, CodeQL/SARIF acceptance, branch/tag protection, and publication endpoints must be verified on one exact committed SHA. npm publication requires package-name availability plus authenticated Trusted Publishing or equivalent owner authorization.

## Recovery protocol

Read `CLAUDE.md`, this file, `docs/DECISIONS.md`, `docs/KNOWN_LIMITATIONS.md`, and `docs/VALIDATION_EVIDENCE.md`; then inspect the remote `main` SHA and hosted workflow state before editing.
