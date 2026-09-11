# Evidence model

AgentBlindspot separates three epistemic states.

- **Observed**: tool-level evidence directly supports the fact, such as a file-read event or coverage artifact.
- **Inferred**: a deterministic repository rule supports the relationship, such as `middleware.ts` importing a changed `session.ts`.
- **Unknown**: evidence is unavailable, unsupported, ambiguous, filtered, or dynamic behavior cannot be resolved.

A **possible blind spot** is an attention state: a classifiable candidate dependent above the relevance threshold with no qualifying inspection and no direct file-level coverage. It is not a defect claim.

Qualifying inspection includes explicit reads, writes/patches, file-specific search results when path provenance exists, and conservative literal shell reads. Natural-language statements do not count.

Verification sources remain separate: LCOV, Istanbul/nyc, and coverage.py can provide direct file evidence; test/build/typecheck/lint commands are recorded as workflow evidence but do not mark arbitrary files directly covered.

Counterexample: an uninspected dependent may be perfectly safe, while a changed and directly covered file can still contain a semantic defect. Component evidence is not system correctness.
