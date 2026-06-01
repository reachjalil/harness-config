# Multi-runtime, one source

This example shows one basic Harness config idea:

```text
one reviewed source folder -> many generated agent folders
```

Instead of copy-pasting the same skill into `.agents`, `.claude`, `.cursor`,
and `.gemini`, the repo keeps the real source under `.harness/resources`.
Activation then generates each runtime folder from that source.

Use this pattern when one repository supports multiple agent runtimes but wants
one durable catalog to review.

Concepts: [resources](../../docs/STANDARD.md#resources),
[targets](../../docs/STANDARD.md#targets),
[overrides](../../docs/STANDARD.md#overrides), and
[ignore rules](../../docs/STANDARD.md#harnessignore).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harness/                       # source humans edit
  harness.toml                  # says which folders receive generated files
  resources/
    hooks.json                  # shared file for every target
    .claude/hooks.json          # Claude-specific replacement
    .cursor/rules/...           # Cursor-specific file
    .gemini/GEMINI.md           # Gemini-specific file
    skills/code-review/
      SKILL.md                  # shared skill for every target
      .claude/SKILL.md          # Claude-specific skill replacement
      .gemini/SKILL.md          # Gemini-specific skill replacement

.agents/ .claude/ .cursor/ .gemini/  # generated output folders
```

## Run it

```bash
npx harnessc validate                                  # check the manifest, paths, targets, and ignore rules
npx harnessc activate                                  # dry run: preview the generated runtime folders
npx harnessc activate --yes                            # apply: write the generated files
npx harnessc activate                                  # convergence check: the next run should report keep
npx harnessc explain .claude/skills/code-review/SKILL.md --json  # inspect why Claude uses its override
```

Expected result:

- `validate` reports no Harness config issues.
- The first `activate` is a dry run and previews generated files.
- `activate --yes` writes `.agents`, `.claude`, `.cursor`, and `.gemini`.
- The second `activate` should converge to `keep` for managed files.
- `explain` shows why the Claude skill came from the Claude override.

## What just happened

Harness projected the shared source into every declared target. Claude and
Gemini received their own skill overrides. Cursor received its own rule file.
The scratch note stayed out of every target because `.harnessIgnore` excludes
it.

Try next: edit `.harness/resources/skills/code-review/SKILL.md`, dry-run again,
and compare the planned updates across all four targets.
