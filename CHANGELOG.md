# Changelog

All notable changes will be documented here.

## [0.1.0] - 2026-09-11

### Added
- Git diff, canonical path handling, commit-range/worktree support, and JS/TS + Python module graphs.
- Normalized coding-agent evidence model with Codex, Claude Code, and OpenCode adapters.
- LCOV, Istanbul/nyc, and coverage.py path ingestion.
- Deterministic reverse-impact traversal with relevance scoring, possible-blind-spot classification, and explicit unknown states.
- Standalone JSON/HTML reporting with local-only security constraints and bounded large-report rendering.
- `doctor`, `adapters`, and `schema` CLI surfaces.
- Reproducible auth-redirect demo and deterministic integration/unit fixtures.
- Cross-platform hosted CI on Linux, macOS, and Windows; installed-package smoke; CodeQL; full benchmark and real-browser release gates.
- Exact-SHA GitHub Release containing the smoke-tested tarball, `package-evidence.json`, and `SHA256SUMS.txt`.

### Security
- Streaming JSONL ingestion with oversized-record and Base64 defenses.
- Repository path escape rejection with canonical path handling across filesystem aliases.
- HTML escaping and Content Security Policy with `connect-src 'none'`.
- CodeQL JavaScript/TypeScript analysis and SARIF upload enabled for the public repository.

### Release discipline
- A possible blind spot is explicitly an attention signal, not proof of a defect.
- The v0.1.0 GitHub Release is tied to exact commit `b1014573264feab70cebc198e24e4598a414c65d` and tarball SHA-256 `5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa`.
- v0.1.0 is not published to the npm registry.

## [Unreleased]

### Added
- JSR package manifest for `@aprashnasuraj-dev/agent-blindspot` library distribution.
- JSR publish dry-run validation with no slow-type bypasses.
- Tokenless GitHub Actions OIDC workflow for JSR publishing.
- Successful JSR publication of `@aprashnasuraj-dev/agent-blindspot@0.1.0` from source commit `89e0252e7a60f8d13219630f85e0c8ef6061a9c9`, with Sigstore provenance.

### Changed
- Removed the abandoned npm-registry publishing workflow.
- Added an explicit public API parameter type required by JSR; runtime behavior is unchanged.
- README and launch documentation now distinguish the GitHub-hosted CLI artifact from the JSR library/module surface.
- Refreshed the development-only `@types/node` package from 25.1.0 to 26.5.0; this does not add or change a runtime dependency.
