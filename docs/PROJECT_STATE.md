# Project state

## Product

AgentBlindspot is a local-first evidence analyzer that joins Git changes, coding-agent tool activity, repository dependency structure, and optional coverage to surface **possible blind spots** without converting missing evidence into defect claims.

## Authoritative repository

`aprashnasuraj-dev/agent-blindspot`, public, default branch `main`.

## Release line

`0.1.0` release candidate. The authoritative release SHA is the exact `main` commit that passes hosted CI, CodeQL/SARIF, full benchmark, real-browser smoke, installed-package smoke, and the release workflow without mutation.

## Completed scope

- Git/path identity and worktree/commit-range diff handling.
- JS/TS + Python dependency graph.
- Normalized evidence and bounded agent adapters.
- LCOV / coverage.py / Istanbul path ingestion.
- Impact traversal, relevance, possible-blind-spot and unknown states.
- Standalone JSON/HTML report with safe evidence detail.
- Doctor/adapters/schema CLI surfaces.
- Security, deterministic fixtures, demo, package smoke, benchmark harness, cross-platform CI and CodeQL workflows.
- Public-repository CodeQL/SARIF upload verified successfully after the repository visibility change.
- Release workflow prepared to publish one exact smoke-tested tarball and only then create the matching GitHub release/tag.

## Remaining external publication dependency

The release workflow supports npm Trusted Publishing/OIDC and an `NPM_TOKEN` fallback. npm authorization is external account state; if neither is configured, the publish job must fail before creating a release tag rather than bypassing authentication.

GitHub branch/tag protection is also repository-setting state. It should be enabled for `main` and release tags, but source validation does not treat an unavailable administration API as evidence that protection exists.

## Recovery protocol

Read `CLAUDE.md`, this file, `docs/DECISIONS.md`, `docs/KNOWN_LIMITATIONS.md`, and `docs/VALIDATION_EVIDENCE.md`; then independently fetch remote `main` and inspect hosted workflow state before editing or publishing.
