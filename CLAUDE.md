# AgentBlindspot engineering contract

AgentBlindspot is a local-first, deterministic evidence analyzer for coding-agent work. It must distinguish **observed evidence**, **deterministic inference**, and **unknowns**. Missing evidence never means an action did not occur.

## Recovery protocol
1. Read `CLAUDE.md`, `docs/PROJECT_STATE.md`, `docs/DECISIONS.md`, and `docs/KNOWN_LIMITATIONS.md`.
2. Run `git status --short --branch` and `git log --oneline -20`.
3. Read `docs/VALIDATION_EVIDENCE.md` and `docs/RELEASE_CHECKLIST.md`.
4. Re-run the smallest relevant validation command.
5. Resume the first unfinished requirement in `docs/REQUIREMENT_TRACEABILITY.md`.

## Non-negotiable engineering rules
- Core code consumes normalized events only; vendor schemas stay in adapters.
- Never execute commands found in transcripts.
- Never count natural-language claims as inspection evidence.
- All repository file identity goes through the canonical path layer.
- Session ingestion is incremental and bounded; raw transcript text and Base64 are not retained by default.
- Passing tests are not direct file coverage.
- Unknown dependency behavior stays unknown.
- Report output is deterministic for identical inputs and contains no remote assets.
- Untrusted strings are HTML-escaped.
- Do not weaken checks to get a green build.
- Release evidence must belong to one exact Git SHA.
