# Runtime-owned state

Seed local settings once, then let the machine own them without committed drift.

For when a runtime needs an initial settings file but will edit that file as it
learns local preferences, permissions, or caches.

Concepts: [mutable files](../../docs/STANDARD.md#mutable-files),
[`.harnessMutable`](../../docs/STANDARD.md#harnessmutable), and
[copy projection](../../docs/STANDARD.md#copy-projection).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessMutable                 # declares settings.local.json mutable
.harness/
  resources/
    settings.local.json         # default seed for all targets
    .claude/settings.local.json # Claude-specific seed
    skills/runtime-state/
.agents/ .claude/               # generated and gitignored
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes

printf '{"createdBy":"runtime","allowedCommands":["pnpm test"]}\n' > .agents/settings.local.json
npx harnessc activate
npx harnessc activate --yes
cat .agents/settings.local.json

npx harnessc activate --yes --force-mutable
cat .agents/settings.local.json
```

The normal re-run reports the changed file as `mutable` and leaves the runtime
edit alone. `--force-mutable` intentionally restores the reviewed seed.

## What just happened

`.harnessMutable` marked the source settings files as seed-once files. They are
created for fresh users, then activation preserves target bytes after the file
exists.

Try next: change the Claude seed and compare a normal apply with
`--force-mutable`.
