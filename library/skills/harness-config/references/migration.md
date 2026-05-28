# Migration

Use this when the repository already has agent-facing files or folders.
Migration should feel helpful and opinionated, but still reversible and
grounded in the user's repo conventions.

## Inventory

Look for:

```bash
rg --files | rg '(^|/)(AGENTS.md|CLAUDE.md|\\.agents|\\.claude|\\.cursor|\\.gemini|skills|plugins|rules|prompts|commands|hooks|agents|settings|mcp|skills-lock\\.json)($|/)'
```

Classify each file as one of:

- durable reusable source;
- target-specific wrapper or packaging;
- repo-relative instruction output;
- runtime-owned local state;
- secret, credential, cache, generated artifact, or trust/permission state.

Also inspect git state before broad moves:

```bash
git status --short
git ls-files AGENTS.md CLAUDE.md .agents .claude .cursor .gemini 2>/dev/null
```

If the repo is under git and the relevant files are tracked, explain that the
transition is easy to review and revert. If important files are untracked,
inspect and summarize them before moving or replacing anything.

Do not treat a large tracked `.agents`, `.claude`, `.cursor`, or `.gemini`
catalog as a reason to stop with a plan-only answer. In a version-controlled
repo, tracked durable files are usually the safest migration source: inventory
and classify them, then make reversible `.harness` source changes and verify
with Harness commands. Pause before editing only for concrete blockers such as
secrets, runtime trust state, unclear ownership, important untracked files, or
destructive cleanup.

## Migration Completeness

When the user asks to set up or migrate Harness config, the default expectation
is a complete migration of durable reviewed agent resources that can be safely
classified. Do not migrate only the `harness-config` helper skill while leaving
other durable skills or prompts unmanaged.

For each discovered live surface, decide:

- migrate portable skills, plugins, rules, prompts, commands, hooks, agents,
  and shared config into a configured `.harness/resources*` root;
- represent target-specific variants as target-derived overrides;
- move root instruction files into `[[dir]]` only when generation is useful;
- leave runtime-owned settings, caches, logs, trust state, credentials, and
  unclear files unmanaged with an explicit reason.

If a repo has many resources, still aim for a clean full migration in one
deliberate pass. Do not recommend batching or a plan-only checkpoint as the
normal path. Pause only when a resource contains secrets, runtime trust state,
executable install behavior, unclear ownership, important untracked content, or
another concrete risk that needs user review. If you must pause, do not write
migration files or call the setup complete; name the blocker and the exact
resources that require a decision.

Do not say `.harness` is now the repository's source of truth when only a
subset was migrated. Say the migration is blocked or incomplete, and name which
live files remain source or unmanaged. This distinction matters because an
agent may otherwise delete, ignore, or overwrite durable resources that were
never moved.

Before editing, inventory the repo and proceed with the full transition by
default. Use the Full Transition Definition below as the implementation and
best-practice checklist: satisfy each applicable row, or identify a blocker or
explicit user preference before activation. The final summary must include:

- skill guide version;
- explicit targets and why each existing surface is included or excluded;
- the chosen layout, including any concern roots based on the repo's workflows,
  domains, teams, target agent sets, or kits;
- recommended resource roots and grouping vocabulary;
- confirmation that target-level seeds such as `.claude/settings.json` stay at
  target-derived paths under the resources root, for example
  `.harness/resources/.claude/settings.json`;
- root-file strategy, including direct copy vs `.harnessComposable`;
- root instruction updates that tell future agents to use Harness config
  guidance for any agent-configuration operation;
- mutable files copied into `.harness` as seed files and their seed locations;
- target-output `.harnessIgnore` files needed in generated surfaces such as
  `.agents` or `.claude`;
- generated-surface root `.gitignore` entries added after convergence, or the
  explicit user preference or constraint for keeping generated output tracked;
- cleanup policy, especially whether unmanaged live files are preserved,
  migrated, archived, or explicitly approved for removal;
- concrete blockers, if any.
- concrete file trees for each common pattern that applies, especially mutable
  settings, direct root instructions, composable root instructions,
  target-derived overrides, and target-output ignores.

If `.claude` exists, contains skills/settings, or has target-specific behavior,
the recommended plan should include `[[targets]] path = "./.claude"` unless
there is a specific reason not to.

## Full Transition Definition

A full transition has all of these properties:

| Area | Full-transition best practice |
| --- | --- |
| Source of truth | Durable agent configuration lives under configured `.harness` source roots. |
| Live surfaces | `.agents`, `.claude`, `.cursor`, `.gemini`, and similar folders are generated outputs with root `.gitignore` entries after convergence, unless the user wants generated output tracked. |
| Skills/resources | Every reusable skill, plugin, prompt, rule, command, hook, and agent is migrated or explicitly blocked with a reason. |
| Root files | Root instructions are normal tracked files, direct `[[dir]]` copies, or composable only when composition is useful. |
| Agent guidance | Root agent instructions tell future agents to modify `.harness` sources and use Harness validation/activation for any agent-config change. |
| Mutable files | Files matched by `.harnessMutable` are copied into `.harness` as source seeds when they should exist for fresh users. |
| Cleanup | Unmanaged live files are preserved until migrated, archived, or explicitly approved for deletion after a dry-run removal list. |
| Target ignores | Generated surfaces have target-output `.harnessIgnore` files when a target needs local-only output rules. |
| Git ignore best practice | Root `.gitignore` ignores each generated surface or exact generated subtree after convergence unless the user wants generated output tracked; target-output `.harnessIgnore` is still used separately for Harness projection boundaries. |
| Local state | Secrets, caches, logs, credentials, trust state, and machine-local settings stay out of `.harness`. |
| Verification | Activation converges after apply. |

Anything less is blocked/incomplete, not the recommended final state.

Use this same table as the implementation checklist before the final summary.
Do not apply activation or claim migration success while durable resources
remain only in live target surfaces.

## Choose Resource Groups

Move durable projected resources into configured resource roots. For most first
full migrations, start with one configured root:

```text
.harness/resources/
  README.md
  .claude/
    settings.json
    .harnessMutable
  skills/
    agent-review/
    ui-review/
  prompts/
  rules/
  plugins/
```

Inside that root, prefer meaningful folders over a flat dumping ground. Let the
user choose the vocabulary: workflows, strategies, teams, modes, kits, agents,
products, or domains.

Target-level files must stay at the target-derived path under the root. For
example, `.claude/settings.json` belongs at
`.harness/resources/.claude/settings.json`, with
`.harness/resources/.claude/.harnessMutable` when it is a create-once mutable
seed. Do not place target-level settings under `skills/`,
an optional kit root, or another unrelated resource group.

Before implementing, spend time understanding the repository and choose the
layout that matches the repo's structure:

| Option | Layout | When to choose |
| --- | --- | --- |
| Default organized | one `.harness/resources` root with `.claude/`, `skills/`, `prompts/`, `rules/`, and `plugins/` siblings | recommended for most first clean migrations, including large skill catalogs |
| Organized subfolders | one `.harness/resources` root with skill families under `skills/` | many skills or prompts with clear workflow/domain names |
| Multiple roots | `.harness/resources`, `.harness/resources-testing`, `.harness/resources-deployment`, `.harness/resources-ui`, `.harness/local/resources` | only when concern catalogs are independently optional, profile-selected, separately owned, or private/local |

Choose one option deliberately and explain why in the final summary. Do not
implement the first workable manifest if the repo has a clearer concern-based
structure.

```text
.harness/
  resources/
    README.md
    .claude/
      settings.json
      .harnessMutable
    skills/
      review/
      ui/
      platform/
    prompts/
    rules/
    plugins/
  local/
    resources/
```

Manifest:

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"
```

Short README files make resource groups portable and copy/pasteable:

```markdown
# Harness Resources

Shared skills, prompts, wrappers, and target-level seeds for this repository's
generated harness surfaces. Personal experiments belong in
`.harness/local/resources`.
```

## Root Instructions

Do not automatically split root instruction files. First decide which stance
fits the repo:

- Keep `AGENTS.md`, `CLAUDE.md`, or similar files as normal tracked files when
  they are simple, already working, and do not need generated variants.
- Move clear shared root instruction files into `[[dir]]` when generation makes
  the setup cleaner. For a simple one-file output, use direct copy:

```text
.harness/dir/AGENTS.md
```

- Use `.harnessComposable` and `.harnessRef` only when composition removes real
  duplication, shares a base across multiple root files, or enables
  profiles/local overlays.
- Convert long procedural root instructions into skills, then leave concise
  root pointers.
- Add or preserve a short Harness maintenance note in `AGENTS.md`, `CLAUDE.md`,
  or equivalent root instructions. The note should say that any future
  operation touching skills, prompts, rules, hooks, commands, target folders,
  settings, ignores, cleanup, or generated surfaces must use Harness config
  guidance, edit `.harness` sources, preview activation, and verify
  convergence.

Example direct copied root instruction:

```text
.harness/dir/AGENTS.md
```

Example maintenance note:

```markdown
## Harness Config Maintenance

This repository manages agent configuration with Harness config. For any change
to skills, prompts, rules, hooks, commands, target folders, settings, ignores,
cleanup, or generated agent surfaces, use the `harness-config` skill guidance,
edit `.harness` sources, run `npx harnessc validate`, preview
`npx harnessc activate`, apply with `npx harnessc activate --yes`, and confirm a
second dry run converges. Treat `.agents`, `.claude`, `.cursor`, `.gemini`, and
similar target folders as generated outputs after adoption.
```

Example composable root instructions, only when the split is useful:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_project.md
  200_workflows.md

.harness/dir/CLAUDE.md/
  .harnessComposable
  .harnessRef
  300_claude_tail.md
```

## Preserve Target Differences

Use target-derived overrides for exact target-specific files:

```text
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.harness/resources/.agents/hooks.json
.harness/resources/.claude/hooks.json
```

Do not duplicate entire resource groups unless the target behavior is genuinely
different.

## Common Transition Trees

Use concrete trees in the migration plan. The goal is for the user to approve
the exact source and output shape, not infer it from Harness terminology.

### Claude Settings As A Mutable Seed

Use this when an existing `.claude/settings.json` should be present for fresh
users, but Claude may edit it locally after first activation.

Before:

```text
.claude/
  settings.json
```

After:

```text
.harness/
  resources/
    .claude/
      settings.json
      .harnessMutable

.claude/
  settings.json
```

`.harness/resources/.claude/settings.json` is the reviewed seed.
`.harness/resources/.claude/.harnessMutable` should contain:

```gitignore
settings.json
```

Do not use `.claude/.harnessIgnore` for this file if the repo wants fresh users
to receive the seed. Target-output `.harnessIgnore` blocks projection for that
target; `.harnessMutable` allows one initial projection and then preserves
runtime edits.

### Direct Root Instruction Copy

Use this for a simple root `AGENTS.md` or `CLAUDE.md` that does not need
composition:

```text
.harness/
  dir/
    AGENTS.md
```

Do not create `.harness/dir/AGENTS.md/.harnessComposable` with one part unless
there is a real reason to support composition, references, profiles, or local
overlays.

### Composable Root Instructions

Use this only when the split has a reason:

```text
.harness/
  dir/
    AGENTS.md/
      .harnessComposable
      100_project.md
      200_workflows.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef
      300_claude_tail.md
```

### Shared Resource With Target Override

Use this when most skill content is shared and only Claude needs different
bytes:

```text
.harness/
  resources/
    skills/
      review/
        SKILL.md
        references/
        .claude/
          SKILL.md
```

The generated `.claude/skills/review/SKILL.md` receives the override. Other
declared targets receive the base `SKILL.md`.

### Target-Output Ignore

Use this only when one generated target needs local output boundaries:

```text
.claude/
  skills/
    review/
      .harnessIgnore
```

Example target-output ignore:

```gitignore
logs/
generated/
```

This does not migrate source and does not create mutable files. It filters only
that target's final output.

## Cleanup And Narrowing

Narrowing the active projection is not the same thing as deleting the old
skills. If the user asks for "only these skills active", first decide where the
inactive durable skills will live:

- keep them in a configured archive/catalog source such as
  `.harness/resources/archive` or `.harness/resources/all-skills`;
- move them to a local/private source when they are personal;
- document them as intentionally unmanaged with a reason;
- delete them only after the user explicitly approves deletion.

Run `npx harnessc activate` before any cleanup and show the exact unmanaged
removal list. Use `npx harnessc activate --yes --remove-unmanaged` only when
each removed durable item is already represented in `.harness`, intentionally
archived, or explicitly approved for deletion. If the old live target folder is
the only copy of a skill, removing it is data loss even when git can recover it.

## Local Layer

Recommend `.harness/local/` as a first-class local workspace:

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"
```

Use it for:

- local skills, plugins, agents, prompts, and wrappers;
- experimental skill edits before promotion;
- personal profile roots or selectors;
- local dir instruction parts when `[[dir]]` is in use;
- temporary ignores.

Suggest `.harness/local/` in `.gitignore` when the user wants this layer
private. Promote useful experiments into tracked resource groups after review.

## `.harnessIgnore` Locality

Prefer scoped ignore files close to the thing they control:

```text
.harnessIgnore                                  # broad repo boundaries
.harness/resources/.harnessIgnore               # source root boundaries
.harness/resources/skills/foo/.harnessIgnore
.harness/profiles/security/resources/.harnessIgnore
.agents/skills/foo/.harnessIgnore               # local output boundary
```

Use root `.harnessIgnore` for obvious global rules. Use source-local ignores
for resource-specific source-only files. Use profile-local ignores for
switchable modes. Use target-output ignores for local output preferences.

Keep ignore patterns narrow and evidence-based. Do not add broad defaults like
`**/*.local.*` or `**/*.local.json` unless those file families actually exist
and the user wants every match excluded or runtime-owned. Prefer exact known
paths such as `**/settings.local.json`.

## Generated Surfaces And Cleanup

Live harness surfaces are generated outputs after full migration. The
best-practice default is to add root `.gitignore` entries for them once all
durable target resources are represented in `.harness` and activation
converges. This keeps skills and reusable resources in one reviewed source
location. Do this unless the user wants generated output tracked. Pair it with
tracked activation instructions so users and agents know how to activate them
on a fresh checkout.

Use root `.gitignore` for Git tracking policy:

```gitignore
# Harness-generated agent surfaces
.agents/
.claude/
.cursor/
.gemini/
```

If only part of a surface is generated, ignore the exact generated subtree
instead:

```gitignore
# Harness-generated Claude skills; other Claude files stay tracked
.claude/skills/
```

Do not confuse this with target-output `.harnessIgnore`. A target-output
`.harnessIgnore` inside `.agents` or `.claude` controls what Harness projects
into that target. Root `.gitignore` controls whether generated outputs are
tracked by Git. A complete migration normally needs both when local target
boundaries exist.

If generated files are already tracked, adding `.gitignore` is not enough to
untrack them. Report the reviewed follow-up after `.harness` is committed and
activation converges:

```bash
git rm -r --cached .agents .claude
```

Use exact subtrees instead when only part of a target is generated.

Good activation instruction examples:

```text
# AGENTS.md

Harness surfaces are generated. Run:

  npx harnessc validate
  npx harnessc activate
```

```json
{
  "scripts": {
    "setup:harness": "npx harnessc validate && npx harnessc activate --yes"
  }
}
```

Use `--remove-unmanaged` only after the dry run clearly shows removals the user
expects. Target-output `.harnessIgnore` and `.harnessProfile` files are local
controls and should be preserved during cleanup.

## Symlinks

Harness config does not follow symlinks while discovering sources or targets.
If a symlinked harness surface points to checked-in agent config and the repo is
under git, replacing it with explicit projection is often a good cleanup.

Workflow:

1. Inspect where the symlink points.
2. Preserve or migrate the real source content into `.harness`.
3. Run `npx harnessc activate` and review the plan.
4. Use `--replace-target-symlinks` or `[activation].targetSymlinks = "replace"`
   only when replacing the link itself is intended.

Stop and ask before changing symlinks that point outside the repo, into a home
directory, secrets, runtime state, or shared machine path.

## Keep Local State Local

Do not move secrets, credentials, caches, runtime permission files, hook trust,
MCP auth, or local machine settings into `.harness`.

## Final Response Checklist

Report enough detail for the user to understand what changed quickly:

- targets declared in `.harness/harness.toml`;
- resource groups created and counts by kind, such as `skills: 4`,
  `prompts: 2`, `hooks: 1`;
- root instruction files kept as normal files or moved into `[[dir]]`;
- target-specific overrides created;
- files intentionally left unmanaged and why;
- commands run: `validate`, dry `activate`, `activate --yes`, convergence dry
  run;
- any remaining migration follow-up.

Prefer this format:

```markdown
**Migration Status**
| Question | Answer |
| --- | --- |
| Complete migration? | Yes |
| Generated targets | `.agents`, `.claude` |
| Source roots | `.harness/resources`, `.harness/dir` |
| Gitignore best practice | Root `.gitignore` ignores generated surfaces after convergence unless intentionally tracked |

**Resource Coverage**
| Kind | Migrated | Left unmanaged | Notes |
| --- | ---: | ---: | --- |
| Skills | 8 | 0 | Shared skills now in `.harness/resources/skills` |
| Prompts | 3 | 0 | Projected to declared targets |
| Runtime state | 0 | 4 | Kept out of `.harness` |

**Verification**
| Command | Result |
| --- | --- |
| `npx harnessc validate` | passed |
| `npx harnessc activate` | reviewed |
| `npx harnessc activate --yes` | applied |
| `npx harnessc activate` | converged |
```

For users who seem new to Harness config, add a short "What this means" section
before next steps:

```text
`.harness` is the editable source. The live `.agents` and `.claude` folders are
generated outputs, so future skill edits should happen under `.harness`.
```

For advanced users, use terse bullets after the tables and include exact paths
and flags rather than introductory explanation.

Use `.harnessMutable` for source templates that should be created once and then
left runtime-owned. Prefer source-local mutable files because they make the
contract visible beside the seed:

```text
.harness/resources/.claude/settings.json
.harness/resources/.claude/.harnessMutable
```

```gitignore
# .harness/resources/.claude/.harnessMutable
settings.json
```

Ignored files stay out of projection. Mutable files are projected when missing
and then preserved. Every mutable file that should exist for a fresh user needs
a seed in `.harness`; do not mark a target file mutable without migrating its
intended initial version.
