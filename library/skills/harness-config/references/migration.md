# Migration

Use this when the repository already has agent-facing files or folders.

## Inventory

Look for:

```bash
rg --files | rg '(^|/)(AGENTS.md|CLAUDE.md|\\.agents|\\.claude|\\.cursor|\\.gemini|skills|plugins|rules|prompts|commands|hooks|settings|mcp)($|/)'
```

Classify each file as one of:

- durable shared source,
- target-specific behavior,
- runtime-owned local state,
- secret, credential, cache, or generated artifact.

## Move durable source

Move shared target resources into `.harness/resources`:

```text
# before
.claude/skills/review/SKILL.md
.agents/skills/review/SKILL.md

# after
.harness/resources/skills/review/SKILL.md
```

Move repo-root instruction outputs into `.harness/dir`:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_project.md
  200_workflows.md
```

When the user wants single-developer customization or experiments, add an
ordered local layer after the shared root instead of editing generated targets:

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

Suggest `.harness/local/` in `.gitignore` only when those changes should stay
private. The spec does not require git awareness.

## Preserve target differences

Use target-derived overrides for exact target-specific files:

```text
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.harness/resources/.agents/hooks.json
.harness/resources/.claude/hooks.json
```

Do not duplicate entire resource trees unless the target behavior is genuinely
different.

## Keep local state local

Do not move secrets, credentials, caches, runtime permission files, or local
machine settings into `.harness`.

Use `.harnessIgnore` for source-only and output-only boundaries:

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

Live harness surfaces are generated outputs. A team may commit them, gitignore
them, or mix committed managed files with local controls. If a surface is
gitignored, keep the reviewed source in `.harness` and use target-output
controls such as `.agents/skills/review/.harnessIgnore` only for local output
boundaries.

## Cleanup

Leave old runtime files in place until a dry-run activation explains the
desired projection. Remove unmanaged target files only when the plan explicitly
shows the intended removal.
