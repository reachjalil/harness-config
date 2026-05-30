# Composable instructions

`CLAUDE.md = AGENTS.md + Claude extras`. Edit shared sections once, then compose
runtime-specific instruction files from the same parts.

For when root instruction files have overlapping content and drift every time a
team updates one runtime.

Concepts: [dir source](../../docs/STANDARD.md#dir-source),
[composable leaves](../../docs/STANDARD.md#composable-leaves), and
[`.harnessRef`](../../docs/STANDARD.md#composable-leaves).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harness/
  dir/
    AGENTS.md/                  # shared composed guide
    CLAUDE.md/                  # imports AGENTS.md, adds Claude extras
    .github/copilot-instructions.md/
                                # imports AGENTS.md, adds Copilot extras
AGENTS.md CLAUDE.md .github/copilot-instructions.md  # generated and gitignored
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate
cat AGENTS.md
cat CLAUDE.md
cat .github/copilot-instructions.md
```

The first dry run previews three generated instruction files. The apply writes
them. The second dry run converges to `keep`.

## What just happened

`AGENTS.md` is composed from numbered parts. `CLAUDE.md` and Copilot's
instruction file import that shared guide with `.harnessRef`, then append their
own runtime-specific tail.

Try next: edit `100_identity.md`, dry-run, and see every composed output update
from the same source change.
