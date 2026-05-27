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

Always explain the current repository state, what can be converted or improved,
and the safest next step before making broad changes. Prefer supported
`npx harnessc` commands whenever the CLI can initialize, validate, preview, or
apply the transition. Use regular file edits only for source authoring,
manual migration, or cases the CLI does not yet automate.

## Reference Map

Read the narrowest reference file needed before making changes. The references
contain the detailed instructions for each area of the skill:

- `references/quick-start.md`: greenfield setup with a minimal manifest,
  resources source, and `[dir]` source.
- `references/migration.md`: migration from existing root instruction files,
  runtime folders, skills, plugins, rules, and local settings.
- `references/skills-sh-adoption.md`: user installed this skill from
  skills.sh or GitHub and wants help transitioning the current repository to
  `.harness`.
- `references/harness-conversion-scenarios.md`: detailed scenarios for
  converting Codex, Claude Code, Gemini CLI, Cursor, plugins/extensions, hooks,
  MCP, rules, commands, and subagents into a `.harness` source layout.
- `references/cli.md`: CLI command usage, dry-run behavior, activation flags,
  and common troubleshooting.
- `references/verification.md`: validation, dry-run activation, apply,
  convergence, and review checks.

## Workflow

1. Identify the user intent: quick start, migration, CLI usage, verification,
   or troubleshooting.
2. If the user installed this skill from skills.sh or GitHub and the repository
   is not already set up for Harness config, treat the task as adoption and read
   `references/skills-sh-adoption.md`.
3. Read the matching reference markdown file before editing or running commands.
4. Inspect existing agent files and harness surfaces before editing.
5. Choose explicit targets only; do not infer targets from folders that happen
   to exist.
6. Create or update `.harness/harness.toml`.
7. Move durable shared content into `.harness/resources` or `.harness/dir`.
8. Keep runtime state, secrets, caches, and local settings out of `.harness`.
9. Add `.harnessIgnore` rules, including `[mutable]` entries for runtime-owned
   files.
10. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
11. Re-run dry activation and confirm convergence.

## User Communication

Before changing a repository with existing agent files, summarize:

- what Harness config can manage in the current repo;
- which existing files look like durable source, target-specific wrappers, or
  runtime state;
- which targets should be declared and why;
- which steps can use `npx harnessc`;
- which steps require ordinary file edits because they are source migration,
  content authoring, or currently outside CLI automation.

Keep the explanation short but concrete. Do not imply that installing the skill
or running `harnessc` automatically decides the migration policy for the user.

## Adoption Scenarios

Recognize these common states and choose the matching path:

- **Skill installed, no `.harness` yet.** The user installed this skill from
  skills.sh or GitHub and wants the agent to help set up Harness config in the
  current repository. Use `references/skills-sh-adoption.md` first, then
  `references/quick-start.md` or `references/migration.md`.
- **New repository.** No meaningful agent configuration exists yet. Use
  `references/quick-start.md` and create only the targets the user actually
  wants.
- **Existing agent surfaces.** Root instructions, `.agents`, `.claude`,
  `.cursor`, `.gemini`, skills, rules, hooks, commands, or settings already
  exist. Use `references/migration.md` and
  `references/harness-conversion-scenarios.md`, then preserve current behavior
  before simplifying.
- **Plugins or extension packs.** Codex plugins, Claude plugins, Gemini
  extensions, Cursor plugin packaging, local marketplaces, or shared plugin
  roots already exist. Use `references/harness-conversion-scenarios.md` to
  split portable components from target-specific packaging wrappers.
- **Already using `.harness`.** Inspect the manifest, sources, ignores, and
  targets before editing. Use `references/cli.md` and
  `references/verification.md` for validation and activation.

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
