---
name: harness-config
description: Use when working with Harness config in a customer repository. Triggers include setting up, adopting, migrating, validating, activating, or troubleshooting .harness/harness.toml, .harness resources, AGENTS.md, CLAUDE.md, .agents, .claude, .cursor, .gemini, skills, rules, plugins, prompts, hooks, .harnessIgnore, mutable files, or CLI commands such as npx harnessc validate and npx harnessc activate.
version: 2026-05-28.full-transition-plan
---

# Harness Config

Skill guide version: `2026-05-28.full-transition-plan`.

When using this skill for setup or migration, include the skill guide version
in the proposed plan and final summary. This lets the user tell whether an
agent used the current adoption rules.

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
  as `AGENTS.md`, `CLAUDE.md`, or setup files when generated repo files improve
  the repo. Prefer a direct copied file such as `.harness/dir/AGENTS.md` for a
  simple root instruction file. Use `.harnessComposable` only when composition
  removes real duplication, shares a base across multiple root files, or
  enables profiles/local overlays.
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
- **Full migration by default.** For existing agent surfaces, prefer migrating
  all durable skills, plugins, rules, prompts, commands, hooks, agents, and
  reusable wrappers into `.harness` in the same pass. Do not recommend a
  partial migration as the normal path; stop only for secrets, runtime trust
  state, unclear ownership, or user direction.
- **Generated surfaces are disposable after full migration.** Once all durable
  target resources are represented in `.harness` and activation converges,
  recommend gitignoring `.agents`, `.claude`, `.cursor`, `.gemini`, or similar
  generated surfaces, with a tracked bootstrap: a small root instruction note,
  README, setup script, or package script telling users and agents to run
  validation and activation.
- **Preserve behavior, then make `.harness` authoritative.** Preserve behavior
  during migration and verification. After convergence, simplify duplicated
  wrappers, symlinks, and stale live outputs so skills have one reviewed source
  location.

## Workflow

1. Identify the user intent: quick start, migration, CLI usage, verification,
   or troubleshooting.
2. If the user installed this skill from skills.sh or GitHub and the repository
   is not already set up for Harness config, treat the task as adoption and read
   `references/skills-sh-adoption.md`.
3. Read the matching reference markdown file before editing or running commands.
4. Inspect existing agent files and harness surfaces before editing.
5. Present a recommended full-transition plan and wait for user approval before
   writing migration files. Do not silently choose a conservative partial
   setup. The plan must state the skill guide version, targets, source roots,
   root-file strategy, mutable seed handling, generated-surface gitignore
   recommendation, and blockers if any.
6. Choose explicit targets from actual intended harness surfaces. If `.claude`,
   `.agents`, `.cursor`, `.gemini`, matching root files, or runtime settings
   are present and durable content exists for them, recommend declaring those
   targets rather than leaving them unmanaged.
7. For setup in a repository with existing agent surfaces, migrate every
   durable reviewed skill, rule, plugin, prompt, command, hook, agent, and root
   instruction file you can confidently classify. Do not stop after promoting
   only the `harness-config` helper skill. Leave a file in the live surface only
   when it is runtime-owned, secret/local, generated/cache state, unsupported,
   or unclear enough to need user review.
8. Create or update `.harness/harness.toml` with explicit `[[resources]]`
   source roots before projecting skills, rules, plugins, prompts, agents,
   hooks, commands, MCP config, or other target resources.
9. Move durable shared content into configured resource groups and use `[[dir]]`
   only when repo-relative output generation improves the repository.
10. Keep runtime state, secrets, caches, and local settings out of committed
   `.harness` source; offer optional local layers when they fit the user's
   workflow.
11. Add scoped `.harnessIgnore` files and narrow `[mutable]` entries for
   runtime-owned files. When a mutable file should exist for fresh users, first
   migrate its initial seed into `.harness`; mutable means "create once from
   source, then preserve runtime edits."
12. Use `npx harnessc explain <path>` for confusing source or output paths.
13. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
14. Re-run dry activation and confirm convergence.

## Plan Approval Gate

Before creating or editing `.harness` files for an existing repository, show a
plan like this and wait for the user to approve it:

```markdown
**Recommended Full Transition Plan**
Skill guide: `2026-05-28.full-transition-plan`

| Decision | Recommendation | Reason |
| --- | --- | --- |
| Targets | `.agents`, `.claude` | Both surfaces exist and contain durable config |
| Source roots | `.harness/resources`, `.harness/dir` | One reviewed source for skills and root files |
| Root files | direct copy `.harness/dir/AGENTS.md` | No composition needed for a single file |
| Mutable files | seed `.harness/resources/.claude/settings.json`, mark target mutable | Fresh users get the file; runtime edits are preserved |
| Generated surfaces | add `.agents/`, `.claude/` to `.gitignore` after convergence | Live surfaces are reproducible outputs |

| Existing item | Action |
| --- | --- |
| `.agents/skills/*` | migrate durable skills |
| `.claude/skills/*` | migrate as shared files or `.claude` overrides |
| `.claude/settings.json` | seed in `.harness`, mark mutable if runtime-owned |
```

If the plan omits an existing harness surface such as `.claude`, explain why.
If there is no good reason, include it. Do not proceed with a partial target set
just because the CLI skeleton can be created quickly.

## Full Transition Checklist

Use this checklist for any existing repository. Do not present the setup as
complete until every required row is satisfied. If a row cannot be satisfied,
stop and report the exact blocker instead of doing a partial adoption.

| Gate | Required evidence |
| --- | --- |
| Inventory complete | All `AGENTS.md`, `CLAUDE.md`, `.agents`, `.claude`, `.cursor`, `.gemini`, skills, plugins, rules, prompts, commands, hooks, agents, settings, and MCP files were scanned. |
| Durable resources migrated | Every reusable skill/resource is under a configured `.harness/resources*` root or intentionally classified as unmanaged with a reason. |
| Target differences preserved | Runtime-specific differences are represented as target-derived overrides, not copied live surfaces. |
| Root files decided | Each root instruction file is either kept tracked as-is, copied directly through `.harness/dir`, or made composable only when composition is actually useful. |
| Mutable seeds present | Every mutable file that should exist for a fresh user has an initial seed in `.harness` before it is listed under `[mutable]`. |
| Ignores are narrow | `.harnessIgnore` contains only evidence-based patterns; no broad `*.local.*` families unless explicitly justified. |
| Generated surfaces handled | After full migration and convergence, `.agents`, `.claude`, `.cursor`, `.gemini`, or similar generated surfaces are recommended for `.gitignore` with a tracked bootstrap. |
| Activation verified | `npx harnessc validate`, dry `activate`, `activate --yes`, and a second dry `activate` all pass and converge. |

Full transition means `.harness` is the reviewed source for durable agent
configuration, while live harness surfaces are generated outputs and local
runtime state remains outside source. It does not mean copying every runtime
file into `.harness`: secrets, caches, logs, trust state, credentials, and
machine-local settings stay local.

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

Assess the user's Harness config familiarity from their wording and the repo
state. If unclear, assume they are new to Harness config but technically
comfortable. Adjust explanation depth without changing the migration standard:
full migration remains the preferred target for existing agent surfaces.

Use concise tables for setup and migration explanations. Tables make it harder
to overclaim scope and easier for the user to review risk. Avoid dense prose
when a small table can show the same facts.

Before changing a repository with existing agent files, summarize:

- what Harness config can manage in the current repo;
- the inventory counts by surface and type, especially how many existing
  skills/plugins/rules/prompts/commands/hooks/agents will be migrated;
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

Recommended pre-change structure:

```markdown
**Assessment**
| Area | Found | Migration decision |
| --- | --- | --- |
| Skills | `.agents/skills/*`, `.claude/skills/*` | Move durable skills into `.harness/resources/skills` |
| Runtime state | `settings.local.json`, logs | Seed intended mutable files in `.harness`; ignore caches/logs |
| Targets | `.agents`, `.claude` | Declare explicit targets |

**Plan**
| Step | Action | Why |
| --- | --- | --- |
| 1 | Inventory all live surfaces | Avoid missing skills/resources |
| 2 | Move durable resources to `.harness` | Make one reviewed source |
| 3 | Activate and converge | Prove generated surfaces are reproducible |
```

For newer users, add a one-sentence meaning line before the tables:

```text
Harness config will make `.harness` the reviewed source and regenerate `.agents`
or `.claude` from it.
```

For experienced users, skip the basics and lead with decisions and commands:

```markdown
**Migration Decisions**
| Decision | Value |
| --- | --- |
| Targets | `.agents`, `.claude` |
| Source roots | `.harness/resources`, `.harness/dir` |
| Generated surfaces | Gitignored after convergence |
```

After setup or migration, report:

- whether this was a complete migration or blocked before completion;
- what was migrated into `.harness` and how many resources by kind;
- what was intentionally left unmanaged and why;
- which targets are now generated from `.harness`;
- the exact validation, dry-run, apply, and convergence commands run;
- the next obvious migration steps if any durable files remain.

Never imply `.harness` is the repository-wide source of truth unless the
inventory shows every durable agent resource was migrated or intentionally left
unmanaged. Do not present partial adoption as the recommended end state; if
completion is blocked, name the blocker and the exact remaining resources.

Recommended post-change structure:

```markdown
**Result**
Complete migration: yes/no. If no, state the blocker in one sentence.

| Resource kind | Migrated | Left unmanaged |
| --- | ---: | --- |
| Skills | 6 | 0 |
| Prompts | 2 | 0 |
| Runtime state | 0 | 3 local files |

| Command | Result |
| --- | --- |
| `npx harnessc validate` | passed |
| `npx harnessc activate` | reviewed creates/updates |
| `npx harnessc activate --yes` | applied |
| second `npx harnessc activate` | converged to keep/mutable |

**What changed**
- `.harness` is now the source for all durable skills/resources.
- `.agents` and `.claude` are generated and can be gitignored.
```

If blocked, use:

```markdown
**Blocked Before Full Migration**
| Remaining item | Why it was not moved | Needed decision |
| --- | --- | --- |
| `.agents/skills/foo/settings.local.json` | runtime-owned local state | ignore or mutable seed |
```

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
- After full migration, prefer gitignored live harness surfaces with reviewed
  source in `.harness` and a tracked bootstrap that regenerates them.

## Source Rules

- Use `.harness/resources*` roots for reusable resources that project into
  target harness surfaces. For non-trivial repos, prefer multiple meaningful
  resource groups over one flat dumping ground.
- Use `.harness/dir*` for repo-relative files such as root `AGENTS.md` and
  `CLAUDE.md` only when generated repo files are useful. Prefer direct copied
  files for simple outputs; use `.harnessComposable` only when composition
  removes real duplication or enables profiles/local overlays. Keeping a root
  file as a normal tracked file is valid.
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
- Do not recommend gitignoring generated harness surfaces until durable
  resources have been migrated and a tracked bootstrap tells users and agents
  how to run activation on fresh checkout. After that, prefer gitignoring them.
- Prefer reversible source edits and show the user what changed with `git diff`
  when practical.
- Preserve existing behavior first; simplify only after activation is stable
  and reviewable.

## Setup Checklist

When setting up or migrating a repository:

1. Read `references/quick-start.md` or `references/migration.md`.
2. Choose explicit targets only; do not infer targets from folders that happen
   to exist.
3. Inventory existing agent surfaces and migrate all durable reviewed resources
   that can be safely classified, not just the `harness-config` skill.
4. Create or update `.harness/harness.toml` with explicit `[[resources]]`
   source roots before projecting skills, rules, plugins, or other target
   resources.
5. Move durable shared content into configured resource groups, and move root
   instruction files into `[[dir]]` only when the assessment says generated
   repo-relative outputs are useful.
6. Keep runtime state, secrets, caches, and local settings out of committed
   `.harness` source; offer optional local roots when the user wants private
   overrides or experiments.
7. Add concise `README.md` files to resource groups whose purpose is not
   obvious.
8. Add nested `.harnessIgnore` rules close to the resource or output they
   control, plus narrow `[mutable]` entries only for seeded runtime-owned files.
9. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
10. Re-run dry activation and confirm convergence.
