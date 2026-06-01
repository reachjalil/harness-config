# Multi-runtime, one source

Stop copy-pasting skills across agent folders. One reviewed source projects to
`.claude`, `.cursor`, `.agents`, and `.gemini`, with small runtime-specific
overrides where they matter.

For when a repo supports several agent runtimes and wants one durable catalog.

Concepts: [resources](../../docs/STANDARD.md#resources),
[targets](../../docs/STANDARD.md#targets),
[overrides](../../docs/STANDARD.md#overrides), and
[ignore rules](../../docs/STANDARD.md#harnessignore).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harness/                       # reviewed source
  harness.toml                  # declares four explicit targets
  resources/
    hooks.json                  # shared target-root file
    .claude/hooks.json          # Claude-only target-root override
    .cursor/rules/...           # Cursor-only target-root file
    .gemini/GEMINI.md           # Gemini-only target-root file
    skills/code-review/
      SKILL.md                  # shared skill
      .claude/SKILL.md          # Claude item override
      .gemini/SKILL.md          # Gemini item override
.agents/ .claude/ .cursor/ .gemini/  # generated and gitignored
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate
npx harnessc explain .claude/skills/code-review/SKILL.md --json
```

The dry run previews creates. The apply writes all four runtime surfaces. The
second dry run converges to `keep` for managed files.

## What just happened

The shared skill was projected to every target. Claude and Gemini received their
item-level overrides, Cursor received a target-root rule file, and the scratch
note stayed out of every target.

Try next: edit `.harness/resources/skills/code-review/SKILL.md`, dry-run again,
and compare the planned updates across all four targets.
