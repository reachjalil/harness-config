---
name: harness-config
description: Use when working with Harness config in a customer repository. Triggers include setting up, adopting, migrating, validating, activating, or troubleshooting .harness/harness.toml, .harness resources, AGENTS.md, CLAUDE.md, .agents, .claude, .cursor, .gemini, skills, rules, plugins, prompts, hooks, .harnessIgnore, .harnessMutable, mutable files, or CLI commands such as npx harnessc validate and npx harnessc activate.
version: 2026-05-29.root-dir-adoption
---

# Harness Config

Skill guide version: `2026-05-29.root-dir-adoption`.

When using this skill for setup or migration, include the skill guide version
in the initial status update and final summary. This lets the user tell whether
an agent used the current adoption rules.

When recommending this skill to another agent or writing a setup prompt, require
the agent to install or update the skill from the canonical GitHub path, then
read the local installed `SKILL.md` before changing files. The agent should not rely
on cached, inherited, or previously loaded copies of the skill.

For an existing repository, "set up Harness config" means a full migration of
durable agent configuration by default. If the user asks for a narrower change,
do that work only as a clearly scoped exception and do not describe it as
Harness config adoption or migration.

When the repository is under version control and the relevant agent files are
tracked, treat that as a good migration surface: inventory, classify, and make
reversible source changes instead of stopping with only a recommended plan. A
large tracked `.agents` or `.claude` catalog is normal migration work, not a
blocker by itself.

## Purpose

Use this skill to help a user operate Harness config in their own repository.
Make agent configuration portable, useful, reviewable, and reusable by moving
durable configuration into `.harness` source roots and treating live harness
surfaces such as `.agents`, `.claude`, `.cursor`, and `.gemini` as generated
outputs once adoption begins.

Once a repository adopts Harness config, any future operation that adds,
removes, narrows, splits, cleans, or reassigns agent configuration must follow
this skill's guidance: edit `.harness` sources, preview activation, explain any
cleanup, and confirm convergence. Do not treat target folders as ordinary
source folders after adoption.

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
  settings. Show concrete file trees for common transitions so the user can
  approve exact paths instead of guessing from abstract rules.
- `references/skills-sh-adoption.md`: user installed this skill from
  skills.sh or GitHub, or wants to promote skills installed with `npx skills`
  into reviewed `.harness` source.
- `references/harness-conversion-scenarios.md`: detailed scenarios for
  converting Codex, Claude Code, Gemini CLI, Cursor, plugins/extensions, hooks,
  MCP, rules, commands, and subagents into a `.harness` source layout.
- `references/examples.md`: practical adoption examples for minimal catalogs,
  resource groups, local layers, profiles, nested ignores, generated surfaces,
  and activation scripts.
- `references/cli.md`: CLI command usage, dry-run behavior, activation flags,
  and common troubleshooting.
- `references/verification.md`: validation, dry-run activation, apply,
  convergence, and review checks.

Do not implement from memory. Before editing a repo, load the reference file
that matches the task and follow its checklist. If the task spans migration,
CLI flags, and verification, read each matching reference before changing
files.

## Decision Model

Use these defaults unless the user's repository clearly points elsewhere:

- **Simplest reviewed layout first.** Choose the smallest `.harness` source
  layout that preserves the repo's durable agent configuration and is easy to
  review. One configured `.harness/resources` root is a good first migration
  default for many repos; additional roots are useful when they represent a real
  ownership, profile, local/private, or reusable concern boundary.
- **Examples are a pattern library.** Use the file trees in this skill as
  examples, not a required taxonomy. Keep target-level seeds at target-derived
  paths, such as `.harness/resources/.claude/settings.json`, but adapt folder
  names and grouping to the repo's existing language.
- **Resource grouping follows the repo.** Group by workflow, team, domain,
  mode, target agent set, or concern only when it improves review or reuse. Add
  short `README.md` files only for non-obvious groups.
- **Understand before installing.** Spend enough time reading the repository to
  choose useful grouping inside the selected resources root. Do not flatten a
  repo that already has clear teams, domains, workflows, agent sets, or reusable
  concerns. Report the chosen structure in progress updates and in the final
  summary.
- **Version control supports action.** In a git-tracked repo, broad migration
  can usually be reviewed and reverted. When the user has asked to configure,
  adopt, or migrate Harness config, proceed with the end-to-end migration after
  inventory unless you find a concrete blocker such as secrets, runtime trust
  state, unclear ownership, untracked important files, or destructive cleanup.
  Do not stop at a plan-only response only because the catalog is large.
- **Node/npx prerequisites are user-facing.** Harness CLI examples use `npx`,
  so the repo needs Node.js/npm available before CLI commands can run. If
  `node`, `npm`, or `npx` is missing, explain that this is a toolchain
  prerequisite rather than a Harness config failure. Suggest the repo's normal
  Node setup path, or a concrete install example such as `brew install node` on
  macOS, then verify with `node --version`, `npm --version`, and
  `npx --version` before continuing.
- **Target-level seeds stay target-level.** Files that live at a target root,
  such as `.claude/settings.json`, `.agents/settings.local.json`, or target
  hooks/config files, should be seeded at the matching target-derived path under
  the resources root, such as `.harness/resources/.claude/settings.json`. Do
  not bury target-level settings inside a skill folder, optional catalog, or
  unrelated resource group unless that entire configured root is intentionally
  selected as an optional catalog.
- **Full migration root files use `[[dir]]`.** During full migration or
  adoption, durable repo-level instruction files such as `AGENTS.md`,
  `CLAUDE.md`, `GEMINI.md`, and similar files should be represented under a
  configured `.harness/dir*` source by default. Use direct copied Markdown
  files such as `.harness/dir/AGENTS.md` for simple outputs. Do not leave those
  root instruction files only as normal tracked repo files after adoption
  unless there is an explicit blocker or user-directed exception. Use
  `.harnessComposable`, `.harnessRef`, or split root instructions only when
  there is a concrete reason such as deduplication, profile overlays, local
  overlays, or target-specific tails.
- **Profiles as modes.** Teach profiles as switchable modes across resource
  groups and concern-specific dir instructions first, and file overlays second.
  For example, a deployment profile might combine testing and deployment
  resources with a deployment-specific `AGENTS.md` part, while a UI profile
  combines shared UI resources with UI-specific instructions. Use profile-local
  `.harnessIgnore` to enable or suppress selected resources without copying a
  whole catalog.
- **Local as first-class.** Recommend `.harness/local/resources` for personal
  skills, plugins, agents, prompts, experiments, and private wrappers. Recommend
  `.harness/local/dir` only when repo-relative generated outputs need local
  overlays. Put local roots after shared roots; suggest gitignoring
  `.harness/local/` when the user wants it private.
- **Nested ignores for locality.** Keep repo-root `.harnessIgnore` small and put
  scoped `.harnessIgnore` files near the resource group, skill, profile, or
  output subtree they control.
- **Mutable is not ignore.** Use `.harnessMutable` for files that should be
  copied from source only when missing, then owned by the runtime. Do not put
  mutable rules in `.harnessIgnore`; ignore means "do not project," while
  mutable means "project the seed once, then preserve runtime edits."
- **Target-output ignores are part of migration.** When a generated surface such
  as `.agents`, `.claude`, `.cursor`, or `.gemini` has local-only output rules,
  add a target-local `.harnessIgnore` in that surface or subtree. Use it for
  runtime output boundaries while keeping source-local ignores near source.
- **Full migration required for existing surfaces.** For existing agent
  surfaces, migrate all durable skills, plugins, rules, prompts, commands,
  hooks, agents, and reusable wrappers into `.harness` in the same pass. Do not
  implement a helper-skill-only, minimal-manifest, or incomplete migration as the
  recommended setup. Stop before writing or applying migration files only if the
  full transition cannot be completed from the current evidence; report the
  blocker and exact durable resources that need user review.
- **Generated surfaces are disposable after full migration.** Once all durable
  target resources are represented in `.harness` and activation converges, the
  best-practice default is to add root `.gitignore` entries for `.agents/`,
  `.claude/`, `.cursor/`, `.gemini/`, or the exact generated subtrees in those
  surfaces. Do this unless the user wants generated outputs tracked. Pair it
  with tracked activation instructions: a small root instruction note, README,
  setup script, or package script telling users and agents to run validation
  and activation.
- **Git ignore is not projection ignore.** Use `.gitignore` to stop tracking
  generated harness surfaces in Git. Use target-output `.harnessIgnore` inside
  generated surfaces only to control Harness projection boundaries. Do not use
  `.gitignore` as a substitute for `.harnessIgnore`, and do not use
  `.harnessIgnore` as a substitute for generated-surface `.gitignore` entries.
- **Regeneration path is part of adoption.** When generated surfaces may be
  absent on a fresh checkout, add a repo-native activation path: `package.json`
  scripts, Makefile targets, justfile recipes, README setup steps, or a root
  agent instruction note. In `package.json` repos, prefer explicit scripts such
  as `harness:validate`, `harness:preview`, and `harness:activate`. Consider a
  guarded `postinstall` only when the repo already accepts install-time setup or
  the user wants generated surfaces activated automatically.
- **Preserve unmanaged until adoption is proven.** Do not use
  `--remove-unmanaged` to make a narrowed projection look clean unless the
  removed live files are already represented in `.harness`, intentionally
  archived, or explicitly approved for deletion. Preserve first, inventory,
  migrate or archive, then remove only after previewing exact removals.
- **Preserve behavior, then make `.harness` authoritative.** Preserve behavior
  during migration and verification. After convergence, simplify duplicated
  wrappers, symlinks, and stale live outputs so skills have one reviewed source
  location.
- **Write the maintenance contract into agent instructions.** During migration,
  recommend adding a concise Harness config note to `AGENTS.md`, `CLAUDE.md`,
  or equivalent root instructions so future agents know that agent config must
  be changed through `.harness` sources and validated with Harness commands.

## Workflow

1. Identify the user intent: quick start, migration, CLI usage, verification,
   or troubleshooting.
2. If the user installed this skill from skills.sh or GitHub and the repository
   is not already set up for Harness config, treat the task as adoption and read
   `references/skills-sh-adoption.md`.
3. Read the matching reference markdown file before editing or running commands.
4. Inspect existing agent files and harness surfaces before editing.
5. Execute a full clean install/migration end to end by default. Use the Full
   Transition Checklist as the implementation checklist and report the checklist
   result in the final summary. In a version-controlled repo, do not answer only
   with the next migration plan unless a concrete blocker prevents safe,
   reversible implementation.
6. When the repo has enough structure to justify it, choose the layout that best
   fits the repo and keep moving. The default option should be a single
   `.harness/resources` root with meaningful subfolders. Use multiple roots only
   when there is a real concern catalog, ownership boundary, profile-selected
   specialization, or private/local layer.
7. Choose explicit targets from actual intended harness surfaces. If `.claude`,
   `.agents`, `.cursor`, `.gemini`, matching root files, or runtime settings
   are present and durable content exists for them, recommend declaring those
   targets rather than leaving them unmanaged.
8. For setup in a repository with existing agent surfaces, migrate every
   durable reviewed skill, rule, plugin, prompt, command, hook, agent, and root
   instruction file you can confidently classify. Copy durable root instruction
   files such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and equivalents into
   `.harness/dir` as direct Markdown files by default; document an explicit
   blocker or user-directed exception before leaving one live-only. Do not stop
   after promoting
   only the `harness-config` helper skill. Leave a file in the live surface only
   when it is runtime-owned, secret/local, generated/cache state, unsupported,
   or unclear enough to need user review. If durable resources remain
   unmigrated, stop and report the blocker instead of activating an incomplete
   projection.
9. Create or update `.harness/harness.toml` with explicit `[[resources]]`
   source roots before projecting skills, rules, plugins, prompts, agents,
   hooks, commands, MCP config, or other target resources.
10. Move durable shared content into configured resource groups and use
    `[[dir]]` for durable root instruction files during full adoption, preferring
    direct copied Markdown files unless composition has a concrete benefit.
11. Keep runtime state, secrets, caches, and local settings out of committed
   `.harness` source; offer optional local layers when they fit the user's
   workflow.
12. Add scoped `.harnessIgnore` files for exclusions and narrow
   `.harnessMutable` entries for runtime-owned files. When a mutable file
   should exist for fresh users, copy its initial reviewed version into
   `.harness` before listing it in `.harnessMutable`; mutable means "copy once
   from source for new users, then preserve runtime edits."
13. Add target-output `.harnessIgnore` files inside generated surfaces such as
   `.agents` or `.claude` when that target needs local-only output boundaries.
14. Use `npx harnessc explain <path>` for confusing source or output paths.
15. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
16. Re-run dry activation and confirm convergence.
17. After activation convergence, check generated-surface `.gitignore` best
    practice. Add root `.gitignore` entries for every generated surface or exact
    generated subtree, such as `.agents/`, `.claude/`, `.cursor/`, and
    `.gemini/`, unless the user wants generated outputs tracked. If files are
    already tracked, report the reviewed follow-up `git rm --cached` step
    instead of silently deleting working-tree files.
18. Add or update a repo-native regeneration command when the repo has a task
    runner, such as `package.json`, `Makefile`, `justfile`, or scripts. Prefer
    explicit commands; add a guarded post-install hook only when it fits the
    repo's install policy.
19. Use `--remove-unmanaged` only after every removed durable item is migrated
    to `.harness`, intentionally archived, or explicitly approved for deletion.
    If approval is unavailable, preserve unmanaged entries and finish the full
    install without destructive cleanup.
20. Before the final response, re-run the Full Transition Checklist as the
    implementation checklist. Do not claim best-practice adoption unless every
    applicable row passes or an explicit user preference/constraint is recorded.

## Full Install Summary Template

For an existing repository, do the full clean install/migration first, then
summarize the decisions with a table like this:

```markdown
**Full Transition Installed**
Skill guide: `2026-05-29.root-dir-adoption`

| Decision | Recommendation | Reason |
| --- | --- | --- |
| Targets | `.agents`, `.claude` | Both surfaces exist and contain durable config |
| Source roots | simplest reviewed `.harness` layout for this repo | Keeps source easy to review while preserving durable config |
| Resource layout | target-level seeds plus skills/prompts/rules grouped by repo vocabulary | Examples are adapted to the repo, not forced |
| Root files | direct copy `.harness/dir/AGENTS.md` | Durable root instructions are represented in `.harness/dir` by default during full adoption |
| Agent instructions | add Harness maintenance note to `AGENTS.md`/`CLAUDE.md` | Future agents must use Harness guidance for agent-config changes |
| Mutable files | copy seed to `.harness/resources/.claude/settings.json`, declare it in `.harnessMutable` | Fresh users get the file once; runtime edits are preserved |
| Target ignores | add `.agents/.harnessIgnore` or subtree ignores when needed | Target-local output boundaries belong with the generated surface |
| Generated surfaces | add `.agents/`, `.claude/` to root `.gitignore` after convergence unless the user wants generated outputs tracked | Live surfaces are reproducible outputs |
| Activation path | add `package.json` scripts, Makefile target, justfile recipe, README step, or guarded install hook | Fresh checkouts can regenerate inactive harness surfaces |
| Cleanup | preserve unmanaged until migrated or explicitly approved for removal | Narrowing active skills must not delete the only copy |

| Existing item | Action |
| --- | --- |
| `.agents/skills/*` | migrate durable skills |
| `.claude/skills/*` | migrate as shared files or `.claude` overrides |
| `.claude/settings.json` | seed in `.harness`, mark mutable if runtime-owned |
```

If the install omits an existing harness surface such as `.claude`, explain
why. If there is no good reason, include it. Do not finish with an incomplete
target set just because the CLI can create a minimal manifest quickly.

## Example Structures

Use relevant file trees in migration summaries and checklists when they clarify
the implementation. Prefer concrete paths over vague phrases like "mark
mutable" or "make composable," but do not force every example into every repo.
For detailed examples, read `references/migration.md` and
`references/examples.md`.

Common one-root migration shape:

```text
.harness/
  harness.toml
  resources/
    .claude/
      settings.json          # target-level reviewed seed
      .harnessMutable        # contains: settings.json
    skills/
      harness-config/
      agent-review/
      ui-review/
    prompts/
```

Split into multiple configured roots only when those roots represent useful
concern catalogs, ownership boundaries, profile-selected specializations, or
private/local overlays. Target-level settings such as `.claude/settings.json`
should not live inside a skill folder or unrelated resource group.

Claude settings seeded once:

```text
.harness/
  harness.toml
  resources/
    .claude/
      settings.json          # reviewed seed copied on first activation
      .harnessMutable        # contains: settings.json

.claude/
  settings.json              # generated once, then runtime-owned
```

Do not put `settings.json` in `.claude/.harnessIgnore` when the goal is to seed
it. Target-output `.harnessIgnore` means "do not project this output";
`.harnessMutable` means "project the seed once, then preserve target edits."

Root instruction choice:

```text
.harness/dir/AGENTS.md                         # direct copy for simple file
.harness/dir/AGENTS.md/.harnessComposable      # only when split is useful
.harness/resources/skills/review/SKILL.md      # shared skill
.harness/resources/skills/review/.claude/SKILL.md
.claude/skills/review/.harnessIgnore           # target-output boundary only
```

## Structure Checklist

During implementation, use these examples for every row that applies:

| Pattern | Expected source shape | Generated/target behavior |
| --- | --- | --- |
| Default resource root | `.harness/resources/.claude`, `.harness/resources/skills`, `.harness/resources/prompts`, `.harness/resources/rules` | One manifest source root projects target-level files and resources together |
| Claude settings seed | `.harness/resources/.claude/settings.json` plus `.harness/resources/.claude/.harnessMutable` containing `settings.json` | `.claude/settings.json` is created once, then reported `mutable` |
| Simple `AGENTS.md` | `.harness/dir/AGENTS.md` | root `AGENTS.md` is copied from one source file during full adoption |
| Composable `AGENTS.md` | `.harness/dir/AGENTS.md/.harnessComposable` plus numbered parts | root `AGENTS.md` is assembled; use only for real composition |
| Shared skill | `.harness/resources/skills/<name>/SKILL.md` | projects to every declared target |
| Target-specific skill | `.harness/resources/skills/<name>/.claude/SKILL.md` | `.claude` receives override; other targets receive base |
| Target-output ignore | `.claude/**/.harnessIgnore` in the generated surface | filters that target only; not a seed and not source migration |
| Generated-surface gitignore | root `.gitignore` contains `.agents/`, `.claude/`, or exact generated subtrees unless the user wants generated outputs tracked | Git stops treating generated outputs as source after convergence; if generated files are already tracked, report the required `git rm --cached` follow-up |
| Repo-native activation | `package.json` scripts, Makefile target, justfile recipe, README setup step, or guarded install hook | Fresh checkouts can regenerate generated surfaces without guessing commands |

## Full Transition Checklist

Use this checklist for any existing repository while implementing and again
before the final summary. Do not present the setup as best-practice complete
until every applicable row is satisfied or an explicit user preference/constraint
is recorded. If a row cannot be satisfied, stop and report the exact blocker
instead of doing an incomplete adoption.

| Gate | Best-practice check |
| --- | --- |
| Inventory complete | All `AGENTS.md`, `CLAUDE.md`, `.agents`, `.claude`, `.cursor`, `.gemini`, skills, plugins, rules, prompts, commands, hooks, agents, settings, and MCP files were scanned. |
| Clean full migration | The migration is not limited to `.harness/harness.toml`, `.harnessIgnore`, helper skills, or maintenance notes while other durable resources remain live-only. |
| Durable resources migrated | Every durable reusable skill/resource is under a configured `.harness/resources*` root; only runtime-owned, secret/local, cache/generated, unsupported, or unclear files remain live-only with a reason. |
| Target differences preserved | Runtime-specific differences are represented as target-derived overrides, not copied live surfaces. |
| Root instructions represented | Durable root instruction files such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and equivalents are copied into `.harness/dir` as direct Markdown files by default, or explicitly documented as blocked/excepted. |
| Agent instructions updated | `AGENTS.md`, `CLAUDE.md`, or equivalent root instructions tell future agents to use Harness config guidance for any agent-config operation and to edit `.harness` sources instead of generated target folders. |
| Mutable seeds present | Every mutable file that should exist for a fresh user is copied into `.harness` as the seed before it is listed in `.harnessMutable`; activation creates it once and then preserves runtime edits. |
| File structures represented | Source and target trees for mutable settings, root instructions, target overrides, and target-output ignores are implemented or reported with blockers. |
| Ignores are narrow | `.harnessIgnore` contains only evidence-based patterns; no broad `*.local.*` families unless explicitly justified. |
| Target ignores present | Generated surfaces such as `.agents` or `.claude` have target-output `.harnessIgnore` files when they need local output boundaries. |
| Generated-surface gitignore checked | After full migration and convergence, root `.gitignore` ignores `.agents`, `.claude`, `.cursor`, `.gemini`, or exact generated subtrees, with tracked activation instructions, unless the user wants generated outputs tracked; if generated files are already tracked, the final summary reports the required `git rm --cached` follow-up. |
| Activation path tracked | A repo-native command or documented setup path exists for validation and activation; package repos usually expose explicit harness scripts. |
| Cleanup reviewed | Any `--remove-unmanaged` run has a reviewed dry-run removal list; no durable skill/resource is deleted from live surfaces unless it exists in `.harness`, is archived, or the user explicitly approved deletion. |
| Activation verified | `npx harnessc validate`, dry `activate`, `activate --yes`, and a second dry `activate` all pass and converge. |

Full transition means `.harness` is the reviewed source for durable agent
configuration, while live harness surfaces are generated outputs and local
runtime state remains outside source. It does not mean copying every runtime
file into `.harness`: secrets, caches, logs, trust state, credentials, and
machine-local settings stay local.

## Best Practice Review Checklist

Use this checklist when the user asks whether an existing Harness config setup
is correct, even when they are not asking for a migration:

| Area | Best-practice check |
| --- | --- |
| Skill version | The installed `harness-config` skill reports the current skill guide version in `SKILL.md`. |
| Source of truth | Durable skills, prompts, rules, hooks, commands, agents, and shared settings are represented in configured `.harness` source roots. |
| Resource organization | Resource groups reflect the repo's real workflows, domains, teams, target agent sets, or reusable concerns when grouping improves review or reuse; a simple layout is acceptable when it remains clear. |
| Target-level seeds | Files such as `.claude/settings.json` are seeded at `.harness/resources/.claude/settings.json`, not hidden inside a skill folder or unrelated resource group. |
| Explicit targets | Every intended live surface is declared as `[[targets]]`; no target is inferred only because a folder exists. |
| Root instructions | Durable root instruction files such as `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and equivalents are represented in `.harness/dir` during full adoption, or explicitly documented as blocked/excepted; `.harnessComposable` is used only when composition adds value. |
| Mutable files | Mutable files that fresh users need are copied into `.harness` as seeds before `.harnessMutable`; `.harnessMutable` is not used as a substitute for source migration. |
| Ignore locality | Source-local ignores live near source; target-output `.harnessIgnore` files live inside `.agents`, `.claude`, or relevant target subtrees when a generated surface needs local output rules. |
| Generated-surface gitignore | Root `.gitignore` ignores each generated surface or exact generated subtree after convergence unless the user wants generated outputs tracked; tracked generated files have the required `git rm --cached` follow-up reported in the final summary. |
| Activation path | Fresh checkouts have a tracked way to run Harness validation and activation, such as package scripts, Makefile targets, justfile recipes, or README steps. |
| Cleanup safety | `--remove-unmanaged` is not used until removals are previewed and each durable item is migrated, archived, or explicitly approved for deletion. |
| Verification | `npx harnessc validate`, dry activation, apply, and a second dry activation converge. |

Report best-practice reviews with a table of findings, risks, and recommended
actions. If multiple improvements are possible, provide options and recommend
the option that best matches the repo's size and ownership model.

## Migration Autonomy

Use risk tiers when deciding whether to stop before making broad changes:

- **Low risk:** the repo is under git, relevant files are tracked or easily
  recreated, the working tree state is understood, no secrets or runtime trust
  state are involved, and the target migration is easy to review. Make
  reversible source edits and verify with dry-run activation.
- **Medium risk:** generated and manual surfaces are mixed, symlinks are
  present, ownership is unclear, or important files are untracked. Proceed with
  non-destructive migration where possible; stop before symlink replacement,
  destructive cleanup, or moving unclear files.
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

Use concise tables for setup and migration summaries. Tables make it harder
to overclaim scope and easier for the user to review risk. Avoid dense prose
when a small table can show the same facts.

While changing a repository with existing agent files, track and later summarize:

- what Harness config can manage in the current repo;
- the inventory counts by surface and type, especially how many existing
  skills/plugins/rules/prompts/commands/hooks/agents will be migrated;
- which existing files look like durable source, target-specific wrappers, or
  runtime state;
- what resource-group vocabulary seems natural for the repo, such as workflows,
  strategies, teams, modes, agent sets, or reusable concerns;
- which durable root instruction files were copied into `.harness/dir`, and
  any explicit blocker or user-directed exception;
- which targets should be declared and why;
- which steps can use `npx harnessc`;
- which steps require ordinary file edits because they are source migration,
  content authoring, or currently outside CLI automation.

Keep the explanation short but concrete. Do not imply that installing the skill
or running `harnessc` automatically decides the migration policy for the user.

Useful progress-update structure:

```markdown
**Assessment**
| Area | Found | Migration decision |
| --- | --- | --- |
| Skills | `.agents/skills/*`, `.claude/skills/*` | Move durable skills into `.harness/resources/skills` |
| Runtime state | `settings.local.json`, logs | Seed intended mutable files in `.harness`; ignore caches/logs |
| Targets | `.agents`, `.claude` | Declare explicit targets |

**Install Path**
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
- the Full Transition Checklist result from implementation;
- what was migrated into `.harness` and how many resources by kind;
- what was intentionally left unmanaged and why;
- which targets are now generated from `.harness`;
- the exact validation, dry-run, apply, and convergence commands run;
- the next obvious migration steps if any durable files remain.

Never imply `.harness` is the repository-wide source of truth unless the
inventory shows every durable agent resource was migrated or intentionally left
unmanaged. Do not present incomplete adoption as the recommended end state; if
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
- After full migration, add root `.gitignore` entries for generated live
  harness surfaces or exact generated subtrees, with reviewed source in
  `.harness` and tracked activation instructions that regenerate them.

## Source Rules

- Use `.harness/resources*` roots for reusable resources that project into
  target harness surfaces. Group resources when it makes ownership, review, or
  reuse clearer; keep the layout simple when the repo does not need more shape.
- Use `.harness/dir*` for durable repo-relative instruction files such as root
  `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and similar files during full adoption.
  Prefer direct copied Markdown files for simple outputs; use
  `.harnessComposable`, `.harnessRef`, or split instructions only when
  composition removes real duplication, supports target-specific tails, or
  enables profiles/local overlays. Leaving a durable root instruction file only
  as a normal tracked repo file after adoption requires an explicit blocker or
  user-directed exception.
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

These commands require Node.js/npm/npx. If `npx` is unavailable, tell the user
to install Node.js with the repo's preferred toolchain first. On macOS, a simple
example is:

```bash
brew install node
node --version
npm --version
npx --version
```

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
  resources have been migrated and tracked activation instructions tell users
  and agents how to run activation on fresh checkout. After that, prefer
  gitignoring them.
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
   control, plus narrow `.harnessMutable` entries only for seeded
   runtime-owned files.
9. Run `npx harnessc validate`, `npx harnessc activate`, then
   `npx harnessc activate --yes`.
10. Re-run dry activation and confirm convergence.
