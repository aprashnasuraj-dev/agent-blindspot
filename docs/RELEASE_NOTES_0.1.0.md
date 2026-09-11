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

## Distribution

v0.1.0 is distributed through the GitHub Release tagged `v0.1.0`. It is not published to the npm registry.

Download `agent-blindspot-0.1.0.tgz`, extract it, and run the built CLI with Node.js 22+:

```bash
tar -xzf agent-blindspot-0.1.0.tgz
node package/dist/apps/cli/src/index.js --version
```

The release points to exact commit:

```text
b1014573264feab70cebc198e24e4598a414c65d
```

The attached tarball SHA-256 is:

```text
5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa
```

`SHA256SUMS.txt` and `package-evidence.json` are attached to the release.

## JSR follow-up

The source has been prepared for JSR under the intended package name `@aprashnasuraj-dev/agent-blindspot`. A full JSR publish dry-run passes. Publication remains separate from this v0.1.0 GitHub Release and requires the JSR scope/package to be created and linked to the GitHub repository before tokenless OIDC publishing can run.

## Security and privacy

V1 is local-first and performs no telemetry/report network calls. Raw transcript prose and binary/Base64 content are not retained by default. Repository path escapes are rejected; standalone HTML escapes untrusted strings and uses a restrictive CSP.

See `SECURITY.md`, `docs/EVIDENCE_MODEL.md`, `docs/COMPATIBILITY.md`, and `docs/KNOWN_LIMITATIONS.md` for the exact evidence and trust boundaries.
