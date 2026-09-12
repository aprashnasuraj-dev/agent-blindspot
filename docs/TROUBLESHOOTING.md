# Troubleshooting AgentBlindspot

This guide is for cases where an AgentBlindspot run completes unexpectedly, reports `UNKNOWN`, or cannot build usable evidence. The goal is to distinguish a tool/configuration problem from a legitimate absence of evidence.

## Start with `doctor`

Run the repository checks before debugging the analysis itself:

```bash
agent-blindspot doctor .
```

If you are developing from source:

```bash
npm ci
npm run verify
node dist/apps/cli/src/index.js doctor .
```

`doctor` should be the first check when the repository path, Git state, Node runtime, or local installation may be involved.

## Exit codes

AgentBlindspot uses explicit exit codes so automation can distinguish configuration problems from analysis results.

| Code | Meaning | What to check |
|---:|---|---|
| `0` | Analysis completed | Inspect the generated report and diagnostics. |
| `2` | Configuration / argument error | Check CLI flags and paths. |
| `3` | No usable diff | Confirm the requested base/head range actually contains changes. |
| `4` | Requested session cannot be parsed or discovered | Check `--agent` and `--session`; prefer an explicit session/export path while debugging. |
| `5` | Strict-mode unsupported evidence | Inspect diagnostics for evidence that intentionally remained unsupported or unknown. |
| `10` | Internal invariant failure | Reduce to a minimal reproducer and report it. |

## No usable diff (`exit 3`)

A successful Git command does not guarantee that the selected comparison contains analyzable changes.

Check the exact range you intend to analyze. For example, if you are comparing committed revisions, make sure the base and head refs are distinct. If you intend to analyze local worktree changes, use the worktree mode supported by the CLI rather than assuming the current branch contains an uncommitted diff.

Do not treat `exit 3` as “no blind spots.” It means the analyzer did not receive a usable change set.

## Session cannot be parsed or discovered (`exit 4`)

Automatic session discovery is convenient, but an explicit path is easier to debug.

Examples:

```bash
agent-blindspot analyze . --agent codex --session latest --format both
agent-blindspot analyze . --agent claude --session ./session.json --format both
```

When debugging:

1. Confirm the selected adapter matches the session producer.
2. Prefer a small, synthetic or safely redacted export.
3. Confirm the file is structured data expected by the adapter; prose that merely says a file was inspected is not inspection evidence.
4. If the export shape is unsupported, preserve that uncertainty instead of converting it into an inferred inspection event.

## Why a file is `UNKNOWN`

`UNKNOWN` is not a weaker spelling of `POSSIBLE_BLIND_SPOT`. It is an explicit boundary: the available graph, path, adapter, or evidence data was insufficient for a safe classification.

Common causes include:

- an import/resolution pattern outside the supported deterministic resolver surface;
- a path that cannot be mapped safely into the repository;
- an adapter/export shape that is not recognized conservatively;
- ambiguous or unsupported coverage metadata.

The correct fix is to improve the evidence or resolver support, not to force the file into a finding state.

## Passing tests but a possible blind spot remains

This can be correct. AgentBlindspot deliberately separates:

- an observed successful test command; and
- direct per-file verification evidence from a supplied coverage artifact.

A passing test command alone does not prove that a particular impacted file executed. If direct file verification matters, supply supported coverage data and verify that its paths map cleanly to the repository.

## Coverage appears to be ignored

Check these in order:

1. The coverage file exists at the path passed to `--coverage`.
2. Its format is one of the documented supported formats.
3. Paths in the artifact resolve into the analyzed repository.
4. The relevant file has direct execution evidence in the artifact.

Do not infer direct verification from aggregate suite success or from a coverage artifact that cannot be mapped safely.

## A finding looks surprising

Treat the report as review prioritization evidence, not a defect verdict.

For a surprising candidate, inspect:

1. the changed file(s) that reached the candidate;
2. the dependency path and structural distance;
3. whether the import edge was resolved with full or reduced confidence;
4. the observed agent inspection evidence;
5. direct coverage evidence, if supplied;
6. diagnostics attached to the run.

A `POSSIBLE_BLIND_SPOT` can still be perfectly safe code. The claim is only that the file is structurally exposed to the change and lacks the configured inspection/direct-verification evidence.

## Building a useful bug report

A minimal reproducer is more valuable than a large private repository. Prefer a tiny synthetic repository containing only the files needed to demonstrate the behavior.

Include:

- Node version and operating system;
- exact AgentBlindspot version or source commit;
- exact command and exit code;
- minimal repository tree;
- the smallest safe/redacted session fixture needed to reproduce the adapter behavior;
- coverage fixture, if coverage mapping is involved;
- expected evidence state;
- actual evidence state and diagnostics.

Never attach real private coding-agent transcripts when a synthetic fixture can reproduce the problem.

## Before filing an issue

Run:

```bash
npm run verify
npm pack --dry-run
```

when working from source, then confirm the behavior still reproduces on the smallest possible fixture. If the problem concerns a packaged CLI, also report whether it reproduces from the exact release artifact.
