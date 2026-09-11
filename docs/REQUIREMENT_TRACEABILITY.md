# Requirement traceability

| Blueprint requirement | Implementation | Primary validation |
|---|---|---|
| Git worktree/commit diff, rename/delete, binary/submodule | `packages/git` | integration Git fixture |
| Canonical paths / repository escape rejection | `packages/git/src/path.ts` | path/security tests |
| JS/TS dependency graph + aliases/workspaces | `packages/graph` | graph fixtures |
| Python dependency graph | `packages/graph` | graph fixtures |
| Normalized event model | `packages/schema` | adapter/evidence tests |
| Codex bounded streaming + discovery | `packages/adapters` | adapter fixtures + full benchmark |
| Claude structured import | `packages/adapters` | structured fixture |
| OpenCode baseline | `packages/adapters` | export-style fixture |
| Evidence index / command distinction | `packages/evidence` | core/evidence tests |
| LCOV / coverage.py / Istanbul | `packages/evidence/src/coverage.ts` | coverage fixture |
| Reverse traversal + relevance | `packages/core` | direction/counterexample tests |
| Possible blind spot vs unknown | `packages/core` | classification tests |
| Standalone HTML + JSON | `packages/report` | XSS/CSP/report tests + browser smoke |
| Doctor / adapters / schema CLI | `apps/cli` | installed/package + CLI integration |
| Security hardening | path, adapter, report, lint | malicious-input tests + CodeQL |
| Cross-platform CI | `.github/workflows/ci.yml` | hosted workflow matrix |
| Reproducible demo | `examples/auth-redirect-demo`, `scripts/demo.mjs` | `npm run demo` |
| Packaging | npm metadata + package smoke | packed artifact evidence |
| Performance | `benchmarks`, browser smoke | exact-SHA release-gates job |
