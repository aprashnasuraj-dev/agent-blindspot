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
- Release workflow that publishes the exact smoke-tested tarball before creating the `v0.1.0` GitHub release tag.

### Security
- Streaming JSONL ingestion with oversized-record and Base64 defenses.
- Repository path escape rejection with canonical path handling across filesystem aliases.
- HTML escaping and Content Security Policy with `connect-src 'none'`.
- CodeQL JavaScript/TypeScript analysis and SARIF upload enabled for the public repository.

### Release discipline
- A possible blind spot is explicitly an attention signal, not proof of a defect.
- Package publication is tied to one exact Git SHA and one exact tarball hash.

## [Unreleased]

No unreleased changes yet.
