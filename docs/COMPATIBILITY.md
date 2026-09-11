# Compatibility

## Runtime

- Node.js >=22.
- Node 24 LTS is the primary release baseline.
- CI covers Node 22 compatibility plus Node 24 on Linux, Windows, and macOS.

## Languages

- JavaScript/TypeScript: static import/export, `require()`, literal dynamic import, common extension/index resolution, tsconfig aliases, and simple workspace-local packages.
- Python: common repository-local absolute/relative imports, `__init__.py`, and conservative ambiguity handling.
- Nonliteral dynamic loading, reflection, plugin registries, and runtime path mutation are surfaced as limitations rather than guessed.

## Agent evidence

- Codex: explicit JSONL input and best-effort local rollout discovery under `CODEX_HOME/sessions`; large records and Base64-bearing payloads are bounded.
- Claude Code: explicit structured JSON / stream-style structured input. Undocumented private caches are not a required interface.
- OpenCode: explicit structured export baseline. Tool-part shapes are version-sensitive and unsupported shapes remain unknown.

## Coverage

- LCOV (`SF:` records)
- coverage.py JSON (`files` map)
- Istanbul/nyc JSON (`path` / `statementMap` records)

Compatibility claims are adapter- and fixture-backed, not promises that vendor storage formats will remain unchanged.
