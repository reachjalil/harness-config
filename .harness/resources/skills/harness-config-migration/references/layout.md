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
    AGENTS.md/
      .harnessComposable
      100_project.md
      200_workflows.md
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
**/*.local.*
**/settings.local.json

[mutable]
**/settings.local.json
**/*.local.json
```

Use target-output `.harnessIgnore` only when one runtime must filter a file
that other targets should still receive.
