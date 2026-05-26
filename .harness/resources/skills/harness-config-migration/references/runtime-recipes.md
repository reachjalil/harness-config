# Runtime Recipes Reference

Read this for common migrations from existing runtime folders.

## Root AGENTS.md

Move reusable root instructions into a `[dir]` composable:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_project.md
  200_commands.md
  300_style.md
```

The output remains root `AGENTS.md`.

## Root CLAUDE.md

When Claude should inherit the shared repo guide, compose it from `AGENTS.md`:

```text
.harness/dir/CLAUDE.md/
  .harnessComposable
  .harnessRef
  200_claude.md
```

Set `.harnessRef` to:

```text
../AGENTS.md
```

Use `.harnessIgnore` inside `CLAUDE.md/` only when an imported part must be
replaced for Claude.

## Codex And Claude Skills

Shared skills usually belong under:

```text
.harness/resources/skills/<skill-name>/SKILL.md
.harness/resources/skills/<skill-name>/references/*.md
.harness/resources/skills/<skill-name>/agents/openai.yaml
```

If a skill needs target-specific instructions, use an override:

```text
.harness/resources/skills/<skill-name>/.claude/SKILL.md
```

## Plugins And Runtime Adapters

Keep portable plugin documentation shared, then add runtime adapter files as
overrides:

```text
.harness/resources/plugins/<plugin-name>/README.md
.harness/resources/plugins/<plugin-name>/.agents/.codex-plugin/plugin.json
.harness/resources/plugins/<plugin-name>/.claude/.claude-plugin/plugin.json
```

If a plugin cannot be represented portably yet, keep the runtime-specific
adapter in its current runtime folder and mark it as intentionally unmigrated.

## Cursor, Gemini, And Other Runtimes

Do not create targets just because folders exist. Add the target only when the
repo should receive generated output there:

```toml
[[targets]]
path = "./.cursor"

[[targets]]
path = "./.gemini"
```

Move shared rules into `.harness/resources/rules` and use `.cursor` or
`.gemini` overrides for runtime-specific filenames or formatting.
