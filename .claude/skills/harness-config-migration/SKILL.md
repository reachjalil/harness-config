---
name: harness-config-migration
description: Use when migrating an existing repository to Harness config from ad hoc agent instructions, runtime folders, or tool-specific configuration. Triggers include converting AGENTS.md, CLAUDE.md, .agents, .claude, .cursor, .gemini, Codex or Claude skills, rules, plugins, prompts, commands, hooks, and local agent settings into a reviewed .harness source tree with explicit targets and activation checks.
---

# Harness Config Migration
## Purpose

Use this skill to migrate a real repository into Harness config without losing
existing agent behavior. The goal is to make reusable instructions and resources
reviewable under `.harness`, keep runtime folders generated, and preserve local
runtime state that should remain user-owned.
## Reference Map

Load the narrowest reference needed:

- `references/inventory.md`: how to find existing agent instructions, runtime
  folders, skills, plugins, rules, hooks, commands, prompts, and local settings.
- `references/layout.md`: how to design `.harness/harness.toml`,
  `.harness/dir`, `.harness/resources`, target overrides, and ignores.
- `references/runtime-recipes.md`: common migrations for Codex, Claude,
  Cursor, Gemini, root `AGENTS.md`, root `CLAUDE.md`, skills, and plugins.
- `references/verification.md`: validation, dry-run activation, apply,
  convergence, diff review, and cleanup checks.
## Workflow

1. Work from the repository root. Confirm the repo has no unexpected dirty
   files before moving existing agent configuration.
2. Read `references/inventory.md` and inventory current agent-facing files.
3. Read `references/layout.md` and choose explicit targets. Do not infer
   targets from folders that happen to exist.
4. Move shared source into `.harness/resources` or `.harness/dir`; keep
   runtime-specific differences as target overrides.
5. Add `.harnessIgnore` rules for secrets, caches, local settings, generated
   files, and `[mutable]` runtime-owned files.
6. Run the checks in `references/verification.md`.
7. Leave old runtime files in place until a dry activation explains the
   desired projection and the second dry run converges after apply.

Prefer `npx harnessc` in repositories that do not already depend on the local
CLI:

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
```
## Guardrails

- Do not edit generated target folders as source after migration begins.
- Do not move secrets, credentials, runtime caches, or local machine settings
  into `.harness`.
- Do not collapse target-specific behavior into shared files unless it is
  actually portable across targets.
- Do not use per-kind `[resources.<kind>]`; v1 uses one resources root with
  resource kinds as ordinary directories.
- Preserve existing behavior first, then simplify once activation is stable.
