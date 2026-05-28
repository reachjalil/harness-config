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
    skills/
    plugins/
    rules/
```

Use `.harness/dir` for repo-root output such as `AGENTS.md` and `CLAUDE.md`.
Use `.harness/resources` for files that project into declared runtime folders.
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
resources. Keep a tracked bootstrap that tells users and agents how to run
activation.

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

## Ignores And Mutable Files

Use root `.harnessIgnore` for migration boundaries:

```gitignore
**/.DS_Store
**/node_modules/
**/logs/
**/settings.local.json

[mutable]
**/settings.local.json
```

Keep ignore and mutable patterns narrow. Do not add broad defaults such as
`**/*.local.*` or `**/*.local.json` unless those exact file families exist and
the user wants all of them treated as runtime-owned.

Mutable files are seeded once from `.harness`, then owned by the runtime. If a
file such as `.claude/settings.json` or `.agents/settings.local.json` should
exist for a fresh user, copy its initial version into the matching `.harness`
resource or dir source and add the target path under `[mutable]`. Do not mark a
file mutable without preserving an intended seed in `.harness`.

Use target-output `.harnessIgnore` only when one runtime must filter a file
that other targets should still receive.
