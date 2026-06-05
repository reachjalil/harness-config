# Layout Reference

Read this when designing the target `.harness` tree.

## Minimal Manifest

Declare only the runtime targets the repo should actually receive:

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[dir]]
path = "./.harness/dir"
```

Add `./.cursor`, `./.gemini`, or other runtime folders only when the repo has
real content for them.

## Source Layout

Use this default shape:

```text
.harness/
  harness.toml
  dir/
    AGENTS.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef
      200_claude.md
  resources/
    .claude/
      settings.json
      .harnessMutable
    skills/
    prompts/
    packs/
    plugins/
    rules/
```

Use `.harness/dir` for repo-root output such as `AGENTS.md` and `CLAUDE.md`.
Use one `.harness/resources` root for the first clean full migration unless a
separate optional catalog, ownership boundary, profile-selected pack, wildcard
package-owned source root, or local layer is genuinely needed. Use subfolders
inside that root for skills, prompts, rules, plugins, packs, and target-derived
settings. Target-level files such as
`.claude/settings.json` belong at `.harness/resources/.claude/settings.json`,
not inside a skill folder, pack folder, or unrelated resource group.
Prefer direct copied files under `.harness/dir` for simple one-file outputs.
Use `.harnessComposable` only when composition removes duplication, shares a
base across root files, or enables profiles/local overlays.

For existing repositories, `.harness/resources` should receive all durable
reviewed resource folders that can be safely classified, not only newly added
helper skills. If any live skills, plugins, prompts, rules, commands, hooks, or
agents remain outside `.harness`, treat the migration as blocked/incomplete,
list them in the summary, and do not call the migration complete.

After full migration and convergence, prefer gitignoring generated harness
surfaces so `.harness` remains the single reviewed source for skills and
resources. Keep tracked activation instructions that tell users and agents how
to run activation.

## Overrides

Target overrides are dot-prefixed folders derived from the first segment of the
target path:

```text
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.harness/resources/.agents/hooks.json
.harness/resources/.claude/hooks.json
```

Keep shared content canonical. Add an override only for target-specific bytes.

## Wildcard Roots And External Target Parents

Use wildcard source roots only when the repository already has repeated,
reviewed, repo-local source ownership:

```toml
[[resources]]
path = "./packages/*/.harness/resources"

[[dir]]
path = "./packages/*/.harness/dir"
```

Wildcard resources and dir roots must stay inside the repo and expand to
existing directories. Do not use them to import source from sibling repos, home
directories, or generated target folders.

Use target `parent` only for output placement, such as sibling worktrees:

```toml
[[targets]]
parent = "../worktrees/*"
path = "./.codex"
```

The `path` value remains static and explicit because activation may create it
under each resolved parent. Target-derived overrides are still based on the
target-local `path`, not on the external parent.

## Profile-Isolated Packs

Use `.harnessProfileIsolation` when a selected profile should make specific
logical resource or dir paths exclusive to that profile pack:

```text
.harnessProfile                         # contains: frontend
.harness/
  packs/
    frontend/
      .harnessProfileRoot               # contains: frontend
      .harnessProfileIsolation
      resources/skills/frontend/SKILL.md
      dir/AGENTS.md/.harnessComposable
      dir/AGENTS.md/100_frontend.md
    backend/
      .harnessProfileRoot               # contains: backend
      .harnessProfileIsolation
  local-packs/
    frontend/
      .harnessProfileRoot               # contains: frontend
      resources/skills/local-frontend/SKILL.md
```

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/packs/*/resources"

[[resources]]
path = "./.harness/local-packs/*/resources"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/packs/*/dir"

[[dir]]
path = "./.harness/local-packs/*/dir"
```

```toml
version = 1

[isolate]
resources = ["skills/**"]
dir = ["AGENTS.md", "AGENTS.md/**"]
```

With `frontend` selected, matching base/general skills and inactive sibling
packs are suppressed. Unrelated resources and dir outputs continue to project,
and same-name local profile roots participate through normal source-root
ordering. Use negated isolation patterns only for intentional carve-outs, such
as `!skills/shared/**`.

## Ignores And Mutable Files

Use root `.harnessIgnore` for projection exclusions:

```gitignore
**/.DS_Store
**/node_modules/
**/logs/
**/settings.local.json
```

Use `.harnessMutable` for create-once runtime-owned seeds:

```gitignore
**/settings.local.json
```

Keep ignore and mutable patterns narrow. Do not add broad defaults such as
`**/*.local.*` or `**/*.local.json` unless those exact file families exist and
the user wants all of them treated as runtime-owned.

Mutable files are seeded once from `.harness`, then owned by the runtime. If a
file such as `.claude/settings.json` or `.agents/settings.local.json` should
exist for a fresh user, copy its initial version into the matching `.harness`
resource or dir source and add the matching source or target pattern to
`.harnessMutable`. Do not mark a file mutable without preserving an intended
seed in `.harness`.

Prefer source-local mutable declarations when they make the contract clearer.
For Claude settings, show this structure in the migration plan:

```text
.harness/
  resources/
    .claude/
      settings.json
      .harnessMutable

.claude/
  settings.json
```

```gitignore
# .harness/resources/.claude/.harnessMutable
settings.json
```

Do not put `settings.json` in `.claude/.harnessIgnore` when it should be
seeded once. Target-output `.harnessIgnore` filters projection; `.harnessMutable`
creates the seed once and then preserves runtime edits.

Use target-output `.harnessIgnore` only when one runtime must filter a file
that other targets should still receive.
