---
name: harness-config-migration
description: Use when migrating an existing repository to Harness config from ad hoc agent instructions, runtime folders, skills, plugins, prompts, commands, hooks, or local agent settings.
version: 2026-05-28.full-transition-plan
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
2. Present a recommended full-transition plan with this skill guide version and
   wait for user approval before writing migration files.
3. Choose explicit targets in `.harness/harness.toml`, including `.claude` when
   `.claude` durable content or settings are present.
4. Move all durable reviewed skills, plugins, rules, prompts, commands, hooks,
   agents, and selected root instruction files into `.harness/resources` or
   `.harness/dir`. Do not stop after migrating only the Harness helper skill.
5. Keep real target-specific differences as target overrides.
6. Add `.harnessIgnore` rules for caches, secrets, generated files, and
   mutable runtime-owned files.
7. Validate, preview, apply, and confirm convergence.

Full transition means durable agent configuration is represented in `.harness`,
live harness surfaces are generated outputs, mutable files have source seeds
when needed, and local runtime state stays local. If any durable resource cannot
be migrated, call the migration blocked/incomplete and name the exact item.

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
- Prefer full migration of durable resources over partial adoption. If blocked,
  say exactly which resources remain and why.
- After full migration and convergence, prefer gitignored generated harness
  surfaces with a tracked bootstrap.
