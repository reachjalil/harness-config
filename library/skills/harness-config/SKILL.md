---
name: harness-config
description: Use when working with Harness config in a customer repository. Triggers include setting up, adopting, migrating, validating, activating, or troubleshooting .harness/harness.toml, .harness resources, AGENTS.md, CLAUDE.md, .agents, .claude, .cursor, .gemini, skills, rules, plugins, prompts, hooks, .harnessIgnore, mutable files, or CLI commands such as npx harnessc validate and npx harnessc activate.
---

# Harness Config

## Purpose

Use this skill to help a user operate Harness config in their own repository.
Make agent configuration portable, useful, reviewable, and reusable by moving
durable configuration into `.harness` source roots and treating live harness
surfaces such as `.agents`, `.claude`, `.cursor`, and `.gemini` as generated
outputs once adoption begins.

Use https://www.harnessconfig.dev/ as the public reference when the user needs
the standard or CLI behavior.

Always inspect the repository before making broad changes. Explain what looks
like durable source, generated output, target-specific wrapper, local runtime
state, or sensitive state. Then recommend an opinionated but reversible path
that matches the user's repo conventions. Prefer supported `npx harnessc`
commands whenever the CLI can initialize, validate, preview, explain, or apply
the transition. Use regular file edits only for source authoring, migration
choices, and cases the CLI does not yet automate.

## Reference Map

Read the narrowest reference file needed before making changes. The references
contain the detailed instructions for each area of the skill:

- `references/quick-start.md`: greenfield setup with a minimal manifest,
  a small portable resource catalog, optional local layer, and first activation.
- `references/migration.md`: migration from existing root instruction files,
  runtime folders, skills, plugins, rules, prompts, agents, hooks, and local
  settings.
- `references/skills-sh-adoption.md`: user installed this skill from
  skills.sh or GitHub, or wants to promote skills installed with `npx skills`
  into reviewed `.harness` source.
- `references/harness-conversion-scenarios.md`: detailed scenarios for
  converting Codex, Claude Code, Gemini CLI, Cursor, plugins/extensions, hooks,
  MCP, rules, commands, and subagents into a `.harness` source layout.
- `references/examples.md`: practical adoption examples for minimal catalogs,
  resource groups, local layers, profiles, nested ignores, generated surfaces,
  and bootstrap scripts.
- `references/cli.md`: CLI command usage, dry-run behavior, activation flags,
  and common troubleshooting.
- `references/verification.md`: validation, dry-run activation, apply,
  convergence, and review checks.

## Decision Model

Use these defaults unless the user's repository clearly points elsewhere:

- **Resources first.** Put reusable skills, rules, plugins, prompts, commands,
  hooks, agents, MCP config, and similar target resources under configured
  `.harness/resources*` roots.
- **Resource groups over dumps.** For real migrations, group resources by
  usefulness: workflow, strategy, product area, team, mode, target agent set, or
  kit. Let the user choose the vocabulary. Add short `README.md` files to
  non-obvious resource roots so someone can copy a folder and understand why it
  exists.
- **`[[dir]]` when useful.** Use `.harness/dir*` for repo-relative outputs such
  as `AGENTS.md`, `CLAUDE.md`, or setup files when generation, composition,
  profile overlays, or local overlays improve the repo. Do not split root
  instruction files into parts just for ceremony.
- **Profiles as modes.** Teach profiles as switchable modes across resource
  groups first, and file overlays second. Use profile-local `.harnessIgnore` to
  enable or suppress selected resources without copying a whole catalog.
- **Local as first-class.** Recommend `.harness/local/resources` for personal
  skills, plugins, agents, prompts, experiments, and private wrappers. Recommend
  `.harness/local/dir` only when repo-relative generated outputs need local
  overlays. Put local roots after shared roots; suggest gitignoring
  `.harness/local/` when the user wants it private.
- **Nested ignores for locality.** Keep repo-root `.harnessIgnore` small and put
  scoped `.harnessIgnore` files near the resource group, skill, profile, or
  output subtree they control.
- **Generated surfaces need bootstrap.** Recommend gitignoring `.agents`,
  `.claude`, `.cursor`, `.gemini`, or similar surfaces only when a tracked
  bootstrap exists: a small root instruction note, README, setup script, or
  package script telling users and agents to run validation and activation.
- **Preserve first, simplify second.** Preserve behavior until activation is
  stable and reviewable. Then simplify duplicated wrappers, symlinks, and stale
  live outputs.

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
6. Create or update `.harness/harness.toml` with explicit `[[resources]]`
   source roots before projecting skills, rules, plugins, prompts, agents,
   hooks, commands, MCP config, or other target resources.
7. Move durable shared content into configured resource groups and use `[[dir]]`
   only when repo-relative output generation improves the repository.
8. Keep runtime state, secrets, caches, and local settings out of committed
   `.harness` source; offer optional local layers when they fit the user's
   workflow.
9. Add scoped `.harnessIgnore` files and `[mutable]` entries for runtime-owned
   files.
10. Use `npx harnessc explain <path>` for confusing source or output paths.
11. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
12. Re-run dry activation and confirm convergence.

## Migration Autonomy

Use risk tiers when deciding whether to ask before making broad changes:

- **Low risk:** the repo is under git, relevant files are tracked or easily
  recreated, the working tree state is understood, no secrets or runtime trust
  state are involved, and the target plan is easy to review. Propose a concise
  plan, then make reversible source edits and verify with dry-run activation.
- **Medium risk:** generated and manual surfaces are mixed, symlinks are
  present, ownership is unclear, or important files are untracked. Explain the
  tradeoff and ask before broad moves, symlink replacement, or cleanup.
- **High risk:** secrets, credentials, local permissions, hook trust, MCP auth,
  approval policy, private machine settings, or executable install behavior are
  involved. Do not migrate automatically.

Symlinks are a normal migration opportunity when they point to checked-in agent
configuration and the repo is under git. Harness config does not follow
symlinks; it projects ordinary files. Use dry-run activation first, then replace
target symlinks only when the user or manifest explicitly selects that policy.

## User Communication

Before changing a repository with existing agent files, summarize:

- what Harness config can manage in the current repo;
- which existing files look like durable source, target-specific wrappers, or
  runtime state;
- what resource-group vocabulary seems natural for the repo, such as workflows,
  strategies, teams, modes, kits, or agent sets;
- whether root files should stay as normal tracked files or move into `[[dir]]`;
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

- Use `.harness/resources*` roots for reusable resources that project into
  target harness surfaces. For non-trivial repos, prefer multiple meaningful
  resource groups over one flat dumping ground.
- Use `.harness/dir*` for repo-relative files such as root `AGENTS.md` and
  `CLAUDE.md` only when generation, composition, profile overlays, or local
  overlays are useful. Keeping a root file as a normal tracked file is valid.
- For single-developer or experimental customization, offer optional ordered
  local source roots such as `.harness/local/resources` and
  `.harness/local/dir`. Explain that later roots override earlier exact paths,
  and suggest `.gitignore` entries only when the user wants that local space
  uncommitted.
- Use target-derived overrides such as `.harness/resources/.claude/...` only
  for files that must differ by harness surface.
- Keep secrets, credentials, runtime caches, and local machine settings out of
  `.harness`.

## CLI Rules

Use `npx harnessc` by default in customer repositories:

1. `npx harnessc validate`
2. `npx harnessc activate`
3. Review the dry-run plan.
4. `npx harnessc explain <path>` for surprising paths.
5. `npx harnessc activate --yes`
6. `npx harnessc activate`

For command details and troubleshooting, read `references/cli.md`.

## Guardrails

- Do not work on Harness config CLI implementation or specification design with
  this skill. This skill is for customer repository usage, setup, migration,
  activation, and verification.
- Do not move secrets, credentials, runtime caches, or local machine settings
  into `.harness`.
- Do not run unreviewed hook scripts, plugin install scripts, MCP servers, or
  generated commands from a repository before explaining the trust boundary and
  getting user approval.
- Use `npx harnessc activate` as a dry run before any `--yes` activation.
- Do not recommend gitignoring generated harness surfaces unless a tracked
  bootstrap tells users and agents how to run activation on fresh checkout.
- Prefer reversible source edits and show the user what changed with `git diff`
  when practical.
- Preserve existing behavior first; simplify only after activation is stable
  and reviewable.

## Setup Checklist

When setting up or migrating a repository:

1. Read `references/quick-start.md` or `references/migration.md`.
2. Choose explicit targets only; do not infer targets from folders that happen
   to exist.
3. Create or update `.harness/harness.toml` with explicit `[[resources]]`
   source roots before projecting skills, rules, plugins, or other target
   resources.
4. Move durable shared content into configured resource groups, and move root
   instruction files into `[[dir]]` only when the assessment says generated
   repo-relative outputs are useful.
5. Keep runtime state, secrets, caches, and local settings out of committed
   `.harness` source; offer optional local roots when the user wants private
   overrides or experiments.
6. Add concise `README.md` files to resource groups whose purpose is not
   obvious.
7. Add nested `.harnessIgnore` rules close to the resource or output they
   control, plus `[mutable]` entries for runtime-owned files.
8. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
9. Re-run dry activation and confirm convergence.
