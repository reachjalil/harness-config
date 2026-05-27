---
name: harness-config-setup
description: Use when setting up, adopting, or migrating a repository to Harness config. Triggers include creating .harness/harness.toml, moving AGENTS.md, CLAUDE.md, .agents, .claude, .cursor, .gemini, skills, rules, plugins, prompts, hooks, or local agent settings into a reviewed Harness config source layout with explicit targets.
---

# Harness Config Setup

## Purpose

Use this skill to set up Harness config in a user's repository. Keep the
repository's durable agent configuration in reviewed source roots and treat live
harness surfaces such as `.agents`, `.claude`, `.cursor`, and `.gemini` as
generated outputs.

Use `harnessconfig.dev` as the public reference when the user needs the
standard or CLI behavior.

## Reference Map

Load the narrowest reference needed:

- `references/quick-start.md`: greenfield setup with a minimal manifest,
  resources source, and `[dir]` source.
- `references/migration.md`: migration from existing root instruction files,
  runtime folders, skills, plugins, rules, and local settings.
- `references/verification.md`: validation, dry-run activation, apply,
  convergence, and review checks.

## Workflow

1. Inspect existing agent files and harness surfaces before editing.
2. Choose explicit targets only; do not infer targets from folders that happen
   to exist.
3. Create or update `.harness/harness.toml`.
4. Move durable shared content into `.harness/resources` or `.harness/dir`.
5. Keep runtime state, secrets, caches, and local settings out of `.harness`.
6. Add `.harnessIgnore` rules, including `[mutable]` entries for runtime-owned
   files.
7. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
8. Re-run dry activation and confirm convergence.

## Guardrails

- Do not treat `.agents`, `.claude`, `.cursor`, `.gemini`, or another live
  harness surface as source after migration begins.
- Do not move secrets, credentials, runtime caches, or local machine settings
  into `.harness`.
- Do not work on Harness config CLI implementation or specification design with
  this skill. This skill is for customer repository setup and migration.
- Preserve existing behavior first; simplify only after activation is stable
  and reviewable.
