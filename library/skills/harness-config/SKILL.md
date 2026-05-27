---
name: harness-config
description: Use when working with Harness config in a customer repository. Triggers include setting up, adopting, migrating, validating, activating, or troubleshooting .harness/harness.toml, .harness resources, AGENTS.md, CLAUDE.md, .agents, .claude, .cursor, .gemini, skills, rules, plugins, prompts, hooks, .harnessIgnore, mutable files, or CLI commands such as npx harnessc validate and npx harnessc activate.
---

# Harness Config

## Purpose

Use this skill to help a user operate Harness config in their own repository.
Keep durable agent configuration in reviewed source roots and treat live harness
surfaces such as `.agents`, `.claude`, `.cursor`, and `.gemini` as generated
outputs.

Use `harnessconfig.dev` as the public reference when the user needs the
standard or CLI behavior.

## Reference Map

Read the narrowest reference file needed before making changes. The references
contain the detailed instructions for each area of the skill:

- `references/quick-start.md`: greenfield setup with a minimal manifest,
  resources source, and `[dir]` source.
- `references/migration.md`: migration from existing root instruction files,
  runtime folders, skills, plugins, rules, and local settings.
- `references/cli.md`: CLI command usage, dry-run behavior, activation flags,
  and common troubleshooting.
- `references/verification.md`: validation, dry-run activation, apply,
  convergence, and review checks.

## Workflow

1. Identify the user intent: quick start, migration, CLI usage, verification,
   or troubleshooting.
2. Read the matching reference markdown file before editing or running commands.
3. Inspect existing agent files and harness surfaces before editing.
4. Choose explicit targets only; do not infer targets from folders that happen
   to exist.
5. Create or update `.harness/harness.toml`.
6. Move durable shared content into `.harness/resources` or `.harness/dir`.
7. Keep runtime state, secrets, caches, and local settings out of `.harness`.
8. Add `.harnessIgnore` rules, including `[mutable]` entries for runtime-owned
   files.
9. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
10. Re-run dry activation and confirm convergence.

## Target Rules

- Choose explicit targets only; do not infer targets from folders that happen
  to exist.
- Do not treat `.agents`, `.claude`, `.cursor`, `.gemini`, or another live
  harness surface as source after migration begins.
- If a live harness surface is gitignored, keep the reviewed source in
  `.harness` and rely on activation to regenerate the surface.

## Source Rules

- Use `.harness/resources` for reusable resources that project into target
  harness surfaces.
- Use `.harness/dir` for repo-relative files such as root `AGENTS.md` and
  `CLAUDE.md` outputs.
- Use target-derived overrides such as `.harness/resources/.claude/...` only
  for files that must differ by harness surface.
- Keep secrets, credentials, runtime caches, and local machine settings out of
  `.harness`.

## CLI Rules

Use `npx harnessc` by default in customer repositories:

1. `npx harnessc validate`
2. `npx harnessc activate`
3. Review the dry-run plan.
4. `npx harnessc activate --yes`
5. `npx harnessc activate`

For command details and troubleshooting, read `references/cli.md`.

## Guardrails

- Do not work on Harness config CLI implementation or specification design with
  this skill. This skill is for customer repository usage, setup, migration,
  activation, and verification.
- Do not move secrets, credentials, runtime caches, or local machine settings
  into `.harness`.
- Preserve existing behavior first; simplify only after activation is stable
  and reviewable.

## Setup Checklist

When setting up or migrating a repository:

1. Read `references/quick-start.md` or `references/migration.md`.
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
