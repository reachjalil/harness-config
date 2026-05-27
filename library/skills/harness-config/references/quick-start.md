# Quick Start

Use this when the repository has no existing agent folders or when the user
wants a clean starting point.

## Minimal manifest

Create `.harness/harness.toml` with only the harness surfaces the repository
should actually receive:

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

Add `.cursor`, `.gemini`, or another target only when the repository has real
content for that harness surface.

## Source layout

Use `.harness/resources` for content projected into target folders:

```text
.harness/
  harness.toml
  resources/
    skills/
      review/
        SKILL.md
    rules/
    plugins/
```

Use `.harness/dir` for repo-relative files such as root instructions:

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
      200_claude.md
```

`AGENTS.md` can hold shared instructions. `CLAUDE.md` can reference it with
`.harnessRef` and add Claude-specific tail content.

## Optional local customization

For a solo developer or an experimental repository, offer an optional local
layer after the committed source roots:

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

Later roots win at the same logical output path. This lets the user try a
personal `AGENTS.md` part, override a skill, or add a target wrapper without
editing the shared source first. If the user wants that layer private, suggest
adding `.harness/local/` to `.gitignore`; do not require it.

## First activation

Run:

```bash
npx harnessc validate
npx harnessc activate
```

Review the dry-run plan. Apply only when the target files match the user's
intent:

```bash
npx harnessc activate --yes
npx harnessc activate
```

The second dry run should converge to `keep` for managed files and `mutable`
for runtime-owned files.
