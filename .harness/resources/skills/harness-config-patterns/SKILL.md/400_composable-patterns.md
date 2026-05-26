## Guardrails

- Keep path bases explicit. Most subtle bugs come from confusing physical
  source paths, logical source paths, output-relative paths, and target output
  paths.
- Preserve the one-way projection model: runtime folders are outputs.
- Prefer adding focused tests before broad refactors.
