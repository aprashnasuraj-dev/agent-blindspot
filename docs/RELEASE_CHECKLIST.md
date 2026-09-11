# Release checklist

- [ ] One exact candidate commit SHA identified.
- [ ] Candidate tree independently re-fetched from GitHub.
- [ ] Clean install succeeds on all supported CI environments.
- [ ] Format, security lint, strict typecheck, tests, fixtures, and demo pass.
- [ ] Linux Node 22 compatibility passes.
- [ ] Linux/Windows/macOS Node 24 pass.
- [ ] Runtime dependency audit has no high-severity production finding.
- [ ] Packed artifact installs in a clean consumer and `--version` / `--help` pass.
- [ ] Package SHA-256 recorded for the exact SHA.
- [ ] 1 GiB ingestion, 10k-file graph, 100k-edge traversal, and 10k-report browser smoke measured.
- [ ] CodeQL analysis and SARIF upload succeed or an external platform blocker is explicitly documented.
- [ ] README, architecture, compatibility, limitations, evidence model, SECURITY, CONTRIBUTING, and changelog are complete.
- [ ] Reproducible auth-redirect demo passes.
- [ ] Apache-2.0 license is present in source and package metadata.
- [ ] `main` force-push/deletion protection and `v*` tag protection configured before release where account controls permit.
- [ ] Package name/version and GitHub tag/release do not already exist.
- [ ] Publish only the already-verified artifact/candidate; never rebuild silently after approval.
- [ ] Re-fetch public endpoints and final remote state before declaring `PUBLISHED`.
