# Known limitations

- V1 is file/module-level analysis, not a symbol-level or interprocedural correctness engine.
- Runtime reflection, computed imports, plugin registries, `sys.path` mutation, and external service behavior may create dependencies the static graph cannot determine.
- Vendor session schemas evolve. Unsupported records degrade to diagnostics/unknowns rather than fabricated observations.
- Direct verification depends on coverage artifacts supplied by the user; a passing test command alone is not direct file coverage.
- Source symlinks are excluded from graph traversal by default to avoid following repository escapes.
- Submodules are treated as opaque repository boundaries.
- Generated/build trees are excluded from the graph by default even when Git reports them changed.
- `--redact-paths` redacts the repository root, but repository-relative filenames may still be sensitive in shared reports.
- The standalone HTML V1 prioritizes list/evidence detail over an interactive graph.

Counterexample: a fully tested change can contain a defect outside the modeled graph, and an uninspected dependent can be completely safe.
