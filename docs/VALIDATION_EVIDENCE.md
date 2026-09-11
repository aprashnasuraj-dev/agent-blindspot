# Validation evidence

This file distinguishes historical/local measurements from release-authoritative hosted evidence.

## Pre-candidate local measurements

Earlier bounded runs reported approximately:

- 1 GiB synthetic session ingestion: ~84 MiB peak RSS.
- 10k-source graph build: under 10 s.
- 100k-edge reverse traversal: under 0.2 s.
- installed tarball CLI `--version` / `--help`: passed.

These numbers are **not release evidence** because the prior local Git object claimed for them was not recoverable. They are retained only as engineering context.

## Release-authoritative evidence

Populate only from workflows/artifacts tied to the final candidate SHA:

| Gate | Exact SHA | Result | Evidence |
|---|---|---|---|
| Linux Node 22 | pending | pending | hosted CI |
| Linux Node 24 | pending | pending | hosted CI |
| Windows Node 24 | pending | pending | hosted CI |
| macOS Node 24 | pending | pending | hosted CI |
| installed package smoke | pending | pending | package evidence artifact |
| 1 GiB / 10k / 100k benchmarks | pending | pending | main release-gates job |
| 10k browser smoke | pending | pending | main release-gates job |
| CodeQL/SARIF | pending | pending | CodeQL workflow |
| artifact SHA-256 | pending | pending | package evidence artifact |

Do not copy evidence from a different SHA into this table.
