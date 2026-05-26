## Guardrails

- Do not hide a regression behind a broad snapshot. Prefer explicit
  assertions for the files and diagnostics that matter.
- Do not skip docs updates for new scenarios; the test matrix is part of the
  project contract.
- Do not rely on generated target files as fixture source. Build fixtures
  under `.harness` and existing target-output selectors only when testing
  target-local ignore or profile behavior.
- Do not call the full quality gate as the only verification. Run focused
  tests first so failures point to the changed behavior.

