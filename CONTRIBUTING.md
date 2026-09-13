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

Good starting points are the issues labeled `good first issue` and `help wanted`. If an issue looks too large, claim a small reproducible slice instead of waiting until you can own the whole feature.

## Pairing and co-authorship

Pairing is welcome when both people do substantive work. Useful splits include fixture/reproduction work paired with implementation/tests, or resolver counterexamples paired with documentation and compatibility notes.

If you want to pair on an issue, comment with the slice you want to own so another contributor can take a complementary slice. Keep the final PR focused and explain who did what.

Use `Co-authored-by:` trailers only for people who materially contributed to the commit. Reviewing, approving, being mentioned, or lending a name is not co-authorship. When a commit is genuinely co-authored, use an email linked to the contributor's GitHub account so GitHub can attribute it correctly.

Example:

```text
Co-authored-by: Contributor Name <contributor@users.noreply.github.com>
```

Do not invent contributors, use alternate accounts to simulate collaboration, or add attribution solely to trigger profile achievements. Accurate provenance matters more than badges.

## Review and merge expectations

A small contribution is preferred over a broad speculative rewrite. Maintainers may ask for a narrower fixture, a counterexample, or a clearer `UNKNOWN` path before accepting new behavior.

Before merge:

- the diff should be focused and understandable;
- relevant tests should pass;
- uncertainty should remain explicit rather than guessed away;
- documentation should describe the supported boundary, not just the happy path;
- authorship and co-authorship should match the work actually performed.

## Release semantics

Do not weaken tests to get CI green. Do not edit a release tag. Release evidence must refer to one exact Git SHA. See `docs/RELEASE_PROCESS.md`.
