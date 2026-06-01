# Composable instructions

This example shows one basic Harness config idea:

```text
small instruction parts -> generated instruction files
```

`AGENTS.md` is built from numbered parts. `CLAUDE.md` and Copilot's instruction
file reuse `AGENTS.md` with `.harnessRef`, then add their own extra section.

Use this pattern when root instruction files share most content and would drift
if each file were edited by hand.

Concepts: [dir source](../../docs/STANDARD.md#dir-source),
[composable leaves](../../docs/STANDARD.md#composable-leaves), and
[`.harnessRef`](../../docs/STANDARD.md#composable-leaves).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harness/
  dir/
    AGENTS.md/                  # shared guide built from numbered parts
    CLAUDE.md/                  # reuses AGENTS.md, adds Claude notes
    .github/copilot-instructions.md/
                                # reuses AGENTS.md, adds Copilot notes

AGENTS.md CLAUDE.md .github/copilot-instructions.md  # generated output
```

## Run it

```bash
npx harnessc validate                                  # check the manifest and composable dir source
npx harnessc activate                                  # dry run: preview the composed instruction files
npx harnessc activate --yes                            # apply: write the generated instruction files
npx harnessc activate                                  # check that nothing new needs to change
cat AGENTS.md                                          # inspect the shared composed guide
cat CLAUDE.md                                          # inspect AGENTS.md plus Claude extras
cat .github/copilot-instructions.md                    # inspect AGENTS.md plus Copilot extras
```

Expected result:

- `validate` reports no Harness config issues.
- The first `activate` previews three generated instruction files.
- `activate --yes` writes `AGENTS.md`, `CLAUDE.md`, and Copilot instructions.
- The second `activate` should converge to `keep`.
- The `cat` commands show the composed file contents.

## What just happened

Harness composed `AGENTS.md` from numbered source parts. `CLAUDE.md` and
Copilot's instruction file imported that shared guide with `.harnessRef`, then
appended their own runtime-specific tail.

Try next: edit `100_identity.md`, dry-run, and see every composed output update
from the same source change.
