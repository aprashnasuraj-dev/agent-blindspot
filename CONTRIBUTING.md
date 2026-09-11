# Contributing to AgentBlindspot

AgentBlindspot is evidence-first. A contribution is successful when it makes the tool more correct, more explicit about uncertainty, or easier to reproduce—not when it merely increases the number of findings.

## Setup

```bash
npm ci
npm run verify
```

Node 24 LTS is the primary baseline; Node 22 is a compatibility target.

## Pull-request contract

Every behavior change should answer: what is observed, what is inferred, and what must remain unknown? Add a counterexample test for a new classification/resolution rule. Never make a vendor-specific field part of core analysis; normalize it in the adapter. Do not add real private transcripts—fixtures must be synthetic or safely redacted.

Before opening a PR, run `npm run verify` and `npm pack --dry-run`. For packaging changes, install the produced tarball into a clean temporary directory and verify `agent-blindspot --version` and `--help` there.

## Good first contributions

Small resolver fixtures, adapter compatibility fixtures, path edge cases, documentation clarifications, coverage-format fixtures, and sanitized real-world demos are preferred first contributions. Large architecture rewrites should begin with an issue describing evidence, tradeoffs, and compatibility impact.

## Release semantics

Do not weaken tests to get CI green. Do not edit a release tag. Release evidence must refer to one exact Git SHA. See `docs/RELEASE_PROCESS.md`.
