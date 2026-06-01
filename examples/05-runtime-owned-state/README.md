# Runtime-owned state

This example shows one basic Harness config idea:

```text
copy a settings file once -> let the runtime own it after that
```

`.harnessMutable` marks files that should be created from source for fresh
users, then preserved after the generated target file exists.

Use this pattern when a runtime needs an initial settings file but will edit
that file as it learns local preferences, permissions, or caches.

Concepts: [mutable files](../../docs/STANDARD.md#mutable-files),
[`.harnessMutable`](../../docs/STANDARD.md#harnessmutable), and
[copy projection](../../docs/STANDARD.md#copy-projection).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessMutable                 # marks settings.local.json as seed-once
.harness/
  resources/
    settings.local.json         # default starter settings
    .claude/settings.local.json # Claude-specific starter settings
    skills/runtime-state/

.agents/ .claude/               # generated output
```

## Run it

```bash
npx harnessc validate                                  # check the manifest, targets, and mutable file rules
npx harnessc activate                                  # dry run: preview starter settings and skill files
npx harnessc activate --yes                            # apply: seed the mutable settings files once

printf '{"createdBy":"runtime","allowedCommands":["pnpm test"]}\n' > .agents/settings.local.json  # simulate a runtime edit
npx harnessc activate                                  # dry run: report the edited file as mutable
npx harnessc activate --yes                            # apply: preserve the runtime-owned edit
cat .agents/settings.local.json                        # confirm the runtime edit survived

npx harnessc activate --yes --force-mutable            # reset mutable files from the source template
cat .agents/settings.local.json                        # confirm the reviewed seed was restored
```

Expected result:

- `validate` reports no Harness config issues.
- The first apply creates starter settings in the targets.
- After editing `.agents/settings.local.json`, normal activation reports it as
  `mutable` and preserves the edit.
- `--force-mutable` intentionally restores the reviewed source seed.

## What just happened

Harness treated the settings files as mutable. That means source creates the
target file once, then the live target file belongs to the runtime. Normal
activation does not overwrite it after it exists.

Try next: change the Claude seed and compare a normal apply with
`--force-mutable`.
