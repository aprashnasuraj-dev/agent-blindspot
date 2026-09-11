# Security policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature when available. Do **not** open a public issue containing credentials, private transcripts, private source code, or a sensitive AgentBlindspot report.

Until a dedicated security contact is published, use a private repository security report rather than email addresses guessed from commit metadata.

## Threat model

AgentBlindspot treats session files, coverage paths, repository filenames, Git metadata, and command strings as untrusted input. V1 security boundaries are:

- no transcript command is executed;
- evidence paths are anchored to the repository and escapes are rejected;
- external symlinks are rejected when explicitly checked and are not intended as graph roots;
- JSONL input is streamed with a 16 MiB retained-record ceiling;
- large Base64/data-URL content is removed before generic parsing/logging;
- raw conversation text is not intentionally embedded in reports;
- HTML escapes user-controlled strings;
- standalone reports use a restrictive CSP with `connect-src 'none'`;
- V1 has no telemetry or cloud upload path.

## Sensitive report handling

A report can reveal filenames and dependency topology even when prompts are excluded. Review a report before sharing it outside the repository's trust boundary. `--redact-paths` hides the repository root, but it does not hash every repository-relative filename.

## Supported versions

Until the first public release, only the current `main` candidate receives security fixes. This section will become a version table after publication.
