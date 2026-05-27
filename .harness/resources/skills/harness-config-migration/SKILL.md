---
name: harness-config-migration
description: Use when migrating an existing repository to Harness config from ad hoc agent instructions, runtime folders, skills, plugins, prompts, commands, hooks, or local agent settings.
---

# Harness config Migration

## Purpose

Use this skill to move existing agent-facing configuration into a reviewed
`.harness` source tree while keeping runtime folders generated and local state
user-owned.

## References

- `references/inventory.md`: how to find existing agent instructions and
  runtime files.
- `references/layout.md`: how to design `.harness/harness.toml`,
  `.harness/dir`, `.harness/resources`, targets, overrides, and ignores.
- `references/runtime-recipes.md`: migration recipes for common agent tools.
- `references/verification.md`: validate, preview, apply, and convergence
  checks.

## Workflow

1. Inventory current agent config and note any secrets or local-only state.
2. Choose explicit targets in `.harness/harness.toml`.
3. Move shared source into `.harness/resources` or `.harness/dir`.
4. Keep real target-specific differences as target overrides.
5. Add `.harnessIgnore` rules for caches, secrets, generated files, and
   mutable runtime-owned files.
6. Validate, preview, apply, and confirm convergence.

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate
```

## Guardrails

- Do not edit generated target folders as source.
- Do not move secrets or local machine settings into `.harness`.
- Do not infer targets from folders that happen to exist.
- Preserve behavior first, then simplify once activation is stable.
