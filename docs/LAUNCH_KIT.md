# Launch kit

Use this only after the exact release SHA has green CI, green CodeQL/SARIF, passing package/browser/benchmark gates, and the GitHub Release assets are reachable with the expected checksum.

## Positioning

**Category:** evidence layer for AI-assisted software engineering.

**One line:** AgentBlindspot maps what a coding agent changed against what it actually inspected, then surfaces structurally impacted files with missing evidence.

**Important qualification:** a possible blind spot is an attention signal, not proof of a bug.

The clearest differentiation is not “better AI review.” AgentBlindspot deliberately avoids using a second model as judge. It joins deterministic repository structure with observed agent activity and optional coverage evidence.

## Why people may care

Coding-agent transcripts are chronological. Software dependencies are structural. A session can look thorough while an unchanged dependent sits outside the agent's observed inspection path. AgentBlindspot turns that mismatch into a reviewable evidence surface.

It is complementary to:
- AI reviewers, which make semantic judgments.
- Code-intelligence tools, which model repository structure.
- Agent-observability tools, which show tool/session behavior.
- Coverage tools, which show executed code.

The product wedge is the **join between those evidence surfaces**.

## GitHub release copy

> AgentBlindspot 0.1.0 is a local-first evidence analyzer for coding-agent workflows. It distinguishes changed, structurally impacted, inspected, directly verified, possible-blind-spot, and unknown files without requiring a second LLM. The release includes a reproducible auth example, standalone HTML/JSON output, bounded Codex ingestion, Claude/OpenCode structured adapters, JS/TS + Python graphs, coverage ingestion, cross-platform CI, CodeQL, installed-package smoke, and exact-SHA release evidence.

Release proof points:

- Tag: `v0.1.0`
- Commit: `b1014573264feab70cebc198e24e4598a414c65d`
- Tarball SHA-256: `5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa`
- Distribution: GitHub Release assets; not the npm registry.

## Hacker News

Suggested title:

> **Show HN: AgentBlindspot – see structurally impacted code your coding agent never inspected**

Body:

> I built AgentBlindspot because coding-agent transcripts are chronological while code dependencies are structural. It overlays observed tool activity on a deterministic repository graph and highlights *possible* blind spots: files exposed to a change with no observed inspection or direct coverage. It runs locally, needs no API key, and does not use a second LLM to judge the first. The repository includes the exact fixture that reproduces the README example, and the GitHub Release attaches the exact smoke-tested package hash tied to one Git SHA. Possible blind spot != proven bug.

## Reddit / developer communities

Suggested title:

> **I built a local tool that shows which impacted files an AI coding agent did not inspect**

Suggested post:

> Coding agents can make a correct change and still skip an unchanged dependent. AgentBlindspot joins the Git diff, repository dependency graph, observed agent reads/searches/patches, and optional coverage. The output separates changed, inspected, directly verified, possible blind spot, and unknown. It is deterministic and local-first rather than another AI reviewer. I would especially value counterexamples where the graph or evidence model is wrong.

The strongest communities are ones where coding-agent users already discuss review quality, agent observability, code intelligence, Claude Code, Codex, OpenCode, or AI-assisted development. Follow each community's self-promotion rules; do not cross-post identical text aggressively.

## Short social copy

> Your coding agent changed the code. What did it *not* inspect? AgentBlindspot joins Git + dependency structure + observed agent activity + optional coverage to surface possible blind spots. Local-first. Deterministic. No second LLM judging the first.

Alternative:

> changed → impacted → inspected? → verified? → possible blind spot. AgentBlindspot is a local evidence layer for AI coding workflows.

## Launch sequence

1. Confirm the public GitHub repository renders correctly and both CI + CodeQL badges are green.
2. Confirm the `v0.1.0` GitHub Release points to `b1014573264feab70cebc198e24e4598a414c65d` and the attached tarball digest is `5a5f94b6c395a56865068b9a54c11c875a74fd034ae988467b42da0f705292aa`.
3. Confirm the README installation instructions use GitHub Release assets rather than claiming npm-registry availability.
4. Lead with the 20-second auth demo, not architecture.
5. Publish one primary launch post first; answer technical questions with concrete fixtures and limitations.
6. Share to additional communities only with community-specific framing.
7. Convert legitimate user reports into minimal fixtures and public issues.
8. Keep the README hero focused on the problem; move deep internals to docs.
9. After the JSR scope/package is created and linked, publish the library surface through GitHub OIDC and then update launch copy with the verified JSR package URL.

## JSR follow-up

The intended JSR package is `@aprashnasuraj-dev/agent-blindspot`. Repository-side JSR verification already passes. Do not advertise the JSR package as published until its package metadata is independently reachable on jsr.io.

JSR is a library/module distribution surface; the CLI release remains on GitHub Releases. Standalone native-style binaries are a separate follow-up.

## Repository discoverability checklist

Recommended GitHub topics:

`coding-agents`, `ai-agents`, `claude-code`, `codex`, `opencode`, `code-review`, `static-analysis`, `impact-analysis`, `dependency-graph`, `agent-observability`, `developer-tools`, `local-first`

Recommended repository description:

> Local-first evidence analyzer for impacted code your coding agent did not inspect or directly verify.

These metadata fields are repository settings, not source files, so set them in GitHub after release if they are not already present.

## What not to do

Do not automate unsolicited promotion, fabricate users/testimonials, buy or exchange stars, imply possible blind spots are proven vulnerabilities, or claim benchmark superiority over unrelated tools. The most credible growth loop is reproducible examples + useful counterexamples + fast fixes.
