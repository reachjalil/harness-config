## Guardrails

- Do not keep legacy behavior in a greenfield migration unless the user asks
  for compatibility.
- Do not make runtime folders implicit.
- Do not turn target folders into source repositories.
- Do not encode product selection, registries, marketplaces, or activation
  presets into v1 core semantics.
- Do not duplicate detailed CLI wording in the standard; keep CLI behavior in
  tooling docs and tests.
- When a behavior spans resources, `[dir]`, profiles, and ignore rules, update
  the spec and tests together. These features are coupled by projection.

