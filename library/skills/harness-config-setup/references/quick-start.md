# Quick Start

Use this when the repository has no existing agent folders or when the user
wants a clean starting point.

## Minimal manifest

Create `.harness/harness.toml` with only the harness surfaces the repository
should actually receive:

```toml
version = 1

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[dir]
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
