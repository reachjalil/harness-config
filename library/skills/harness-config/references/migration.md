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

## Migration Completeness

When the user asks to set up or migrate Harness config, the default expectation
is a complete migration of durable reviewed agent resources that can be safely
classified. Do not migrate only the `harness-config` helper skill while leaving
other durable skills or prompts unmanaged without saying so.

For each discovered live surface, decide:

- migrate portable skills, plugins, rules, prompts, commands, hooks, agents,
  and shared config into a configured `.harness/resources*` root;
- represent target-specific variants as target-derived overrides;
- move root instruction files into `[[dir]]` only when generation is useful;
- leave runtime-owned settings, caches, logs, trust state, credentials, and
  unclear files unmanaged with an explicit reason.

If a repo has many resources, still aim for a full migration in one deliberate
pass. Do not recommend batching as the normal path. Pause only when a resource
contains secrets, runtime trust state, executable install behavior, unclear
ownership, or another concrete risk that needs user review. If you must pause,
do not call the setup complete; name the blocker and the exact resources that
remain.

Do not say `.harness` is now the repository's source of truth when only a
subset was migrated. Say the migration is blocked or incomplete, and name which
live files remain source or unmanaged. This distinction matters because an
agent may otherwise delete, ignore, or overwrite durable resources that were
never moved.

Before editing, present the recommended full-transition plan and wait for user
approval. The plan must include:

- skill guide version;
- explicit targets and why each existing surface is included or excluded;
- resource roots and grouping vocabulary;
- root-file strategy, including direct copy vs `.harnessComposable`;
- root instruction updates that tell future agents to use Harness config
  guidance for any agent-configuration operation;
- mutable files and their seed locations in `.harness`;
- generated-surface `.gitignore` recommendation after convergence;
- concrete blockers, if any.

If `.claude` exists, contains skills/settings, or has target-specific behavior,
the recommended plan should include `[[targets]] path = "./.claude"` unless
there is a specific reason not to.

## Full Transition Definition

A full transition has all of these properties:

| Area | Full-transition requirement |
| --- | --- |
| Source of truth | Durable agent configuration lives under configured `.harness` source roots. |
| Live surfaces | `.agents`, `.claude`, `.cursor`, `.gemini`, and similar folders are generated outputs, preferably gitignored after convergence. |
| Skills/resources | Every reusable skill, plugin, prompt, rule, command, hook, and agent is migrated or explicitly blocked with a reason. |
| Root files | Root instructions are normal tracked files, direct `[[dir]]` copies, or composable only when composition is useful. |
| Agent guidance | Root agent instructions tell future agents to modify `.harness` sources and use Harness validation/activation for any agent-config change. |
| Mutable files | Files marked `[mutable]` have source seeds in `.harness` when they should exist for fresh users. |
| Local state | Secrets, caches, logs, credentials, trust state, and machine-local settings stay out of `.harness`. |
| Verification | Activation converges after apply. |

Anything less is blocked/incomplete, not the recommended final state.

## Choose Resource Groups

Move durable projected resources into configured resource roots. For tiny
repos, one root is fine:

```text
.harness/resources/
  README.md
  skills/
  rules/
  plugins/
```

For real migrations, prefer meaningful resource groups over a flat dumping
ground. Let the user choose the vocabulary: workflows, strategies, teams,
modes, kits, agents, products, or domains.

```text
.harness/
  resources-review/
    README.md
    skills/
    rules/
  resources-cloudflare-react/
    README.md
    skills/
    plugins/
    hooks.json
  local/
    resources/
```

Manifest:

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/resources-cloudflare-react"

[[resources]]
path = "./.harness/local/resources"
```

Short README files make resource groups portable and copy/pasteable:

```markdown
# Cloudflare React Resources

Skills, wrappers, and prompts for repositories using React on Cloudflare.
Shared source is tracked here; personal experiments belong in
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
.harness/resources-review/skills/review/SKILL.md
.harness/resources-review/skills/review/.claude/SKILL.md
.harness/resources-review/.agents/hooks.json
.harness/resources-review/.claude/hooks.json
```

Do not duplicate entire resource groups unless the target behavior is genuinely
different.

## Local Layer

Recommend `.harness/local/` as a first-class local workspace:

```toml
[[resources]]
path = "./.harness/resources-review"

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
.harness/resources-review/.harnessIgnore        # group boundaries
.harness/resources-review/skills/foo/.harnessIgnore
.harness/profiles/security/resources-review/.harnessIgnore
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

Live harness surfaces are generated outputs after full migration. Prefer
gitignoring them once all durable target resources are represented in
`.harness` and activation converges. This keeps skills and reusable resources in
one reviewed source location. Require a tracked bootstrap so users and agents
know how to activate them on a fresh checkout.

Good bootstrap examples:

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
| Gitignore recommendation | Gitignore generated surfaces after this commit |

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

Use `[mutable]` for source templates that should be created once and then left
runtime-owned:

```gitignore
[mutable]
**/settings.local.json
```

Ignored files stay out of projection. Mutable files can be created once and
then preserved.

Every mutable file that should exist for a fresh user needs a seed in
`.harness`. For example, if `.claude/settings.json` should be present on first
activation but then runtime-owned, place the initial file at the corresponding
`.harness` resource or dir source path and add that target path under
`[mutable]`. Do not mark a target file mutable without migrating its intended
initial version.
