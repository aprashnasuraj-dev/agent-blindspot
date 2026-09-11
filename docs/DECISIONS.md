# Decisions

## Accepted

- Local-first analysis; no hosted service required for V1.
- No second LLM required for scoring.
- File/module impact before symbol/call-graph analysis.
- Vendor adapters normalize to one stable event schema.
- Streaming session ingestion; never whole-file rollout loading.
- Test execution and direct coverage remain separate.
- User-facing wording is **possible blind spot**, not proof of a missed bug.
- Standalone HTML plus versioned JSON are primary outputs.
- Node 24 LTS is primary, Node >=22 supported.
- Apache-2.0 selected for the initial open-source release because it combines permissive reuse with an explicit patent grant.

## Rejected for V1

A live MCP/LLM judge architecture was rejected because it adds coupling, setup friction, non-determinism, and a second probabilistic judgment layer. It can complement future evidence collection but must not replace deterministic post-hoc analysis.
