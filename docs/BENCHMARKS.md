# Benchmarks

Release targets from the engineering blueprint:

| Scenario | Target |
|---|---:|
| 1 GiB synthetic session JSONL | peak RSS <= 350 MiB |
| 10k source files | graph build <= 30 s on the recorded runner |
| 100k dependency edges | reverse traversal <= 2 s |
| 10k-finding standalone report | browser smoke <= 5 s |

Run the full non-browser harness with:

```bash
npm run benchmark -- --full
```

Run the real browser smoke with:

```bash
npm run browser:smoke
```

Do not publish local/pre-candidate numbers as release measurements. Record runner OS, Node version, exact Git SHA, wall time, and peak RSS from the final hosted release-gates job.
