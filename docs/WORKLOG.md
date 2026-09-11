# Worklog

## 2026-09-11

- Audited an initially empty private GitHub repository and the GitHub Release Engineering Reuse Kit.
- Adapted the kit's exact-SHA, installed-artifact, immutable-Action, and no-weakened-gates principles to a TypeScript CLI.
- Built the V1 evidence pipeline, deterministic demo, security hardening, package smoke, and performance harness.
- Reworked event ingestion so the production CLI consumes `AsyncIterable` evidence instead of accumulating the whole session.
- Replaced repeated queue sorting in impact traversal with deterministic bounded-depth processing.
- Added conservative Codex discovery, tsconfig/workspace resolution, deleted-file tombstones, symlink exclusion, binary/submodule semantics, richer report evidence, and strict-mode behavior.
- Re-audit found that a previously quoted local tree SHA was not present in GitHub and the recoverable uncommitted Git tree was incomplete. Rebuilt a complete candidate from verifiable Git objects rather than asserting false provenance.

Do not mark release complete until the hosted exact-SHA gate matrix is recorded in `docs/VALIDATION_EVIDENCE.md`.
