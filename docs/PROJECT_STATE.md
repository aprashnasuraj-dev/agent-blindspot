# Project state

## Product

AgentBlindspot is a local-first evidence analyzer that joins Git changes, coding-agent tool activity, repository dependency structure, and optional coverage to surface **possible blind spots** without converting missing evidence into defect claims.

## Authoritative repository

`aprashnasuraj-dev/agent-blindspot`, public, default branch `main`.

## Release line

`v0.1.0` is publicly released on GitHub from exact commit `b1014573264feab70cebc198e24e4598a414c65d`.

The attached release tarball is `agent-blindspot-0.1.0.tgz`, size 45,998 bytes, SHA-256 `5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa`. `package-evidence.json` and `SHA256SUMS.txt` are attached to the same release.

The npm registry is not the v0.1.0 distribution channel.

## Completed scope

- Git/path identity and worktree/commit-range diff handling.
- JS/TS + Python dependency graph.
- Normalized evidence and bounded agent adapters.
- LCOV / coverage.py / Istanbul path ingestion.
- Impact traversal, relevance, possible-blind-spot and unknown states.
- Standalone JSON/HTML report with safe evidence detail.
- Doctor/adapters/schema CLI surfaces.
- Security, deterministic fixtures, demo, package smoke, benchmark harness, cross-platform CI and CodeQL workflows.
- Public-repository CodeQL/SARIF upload verified successfully.
- Exact-SHA GitHub v0.1.0 release created only after hosted verification, benchmark, browser smoke, deterministic tarball hash check, and isolated package smoke.
- JSR manifest added for `@aprashnasuraj-dev/agent-blindspot`.
- JSR verification passes a real `jsr publish --dry-run` without slow-type bypasses.
- Tokenless GitHub OIDC JSR publishing workflow prepared.

## Remaining external JSR publication dependency

Before the JSR publishing workflow can publish, the JSR scope/package must exist and be linked to `aprashnasuraj-dev/agent-blindspot` in the package settings on jsr.io. Once linked, the dedicated release branch can trigger OIDC publication without a registry token or stored publishing secret.

JSR is intended as a library/module distribution surface. The v0.1.0 CLI remains directly downloadable from GitHub Releases.

## Optional standalone binaries

Standalone Windows/macOS/Linux binaries remain a follow-up, not a v0.1.0 requirement. The current Node 24 baseline makes a no-runtime single-file executable less straightforward than a later Node SEA baseline, so binary packaging should be added behind its own reproducible build and smoke gates rather than weakening the existing release evidence.

## Repository governance

GitHub branch/tag protection is repository-setting state. It should be enabled for `main` and release tags, but source validation does not treat an unavailable administration API as evidence that protection exists.

## Recovery protocol

Read `CLAUDE.md`, this file, `docs/DECISIONS.md`, `docs/KNOWN_LIMITATIONS.md`, and `docs/VALIDATION_EVIDENCE.md`; then independently fetch remote `main`, the `v0.1.0` GitHub Release, and hosted workflow state before editing or publishing.
