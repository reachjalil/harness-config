# Harness config examples

Eight runnable mini-repositories show the v1 surface from first projection to
switchable modes, kits, composition, mutable state, private local overlays, and
wildcard fanout.

## 30-second wow path

Start with the switchability example:

```bash
cd examples/02-profile-mode-switching
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
printf 'security-audit\n' > .harnessProfile
npx harnessc activate
npx harnessc activate --yes --remove-orphans
```

That one-line selector change previews the move from frontend mode to
security-audit mode before anything is written. When applying a profile switch,
add `--remove-orphans` to remove unedited files from the previously selected
profile. Use `--remove-unmanaged` separately when cleaning files that no
configured source can produce anymore, such as outputs from deleted or newly
ignored source files.

## The arc

| Example | Use case | Hook |
| --- | --- | --- |
| [01-multi-runtime-one-source](01-multi-runtime-one-source/README.md) | One source projects to `.claude`, `.cursor`, `.agents`, and `.gemini` with runtime overrides | Stop copy-pasting skills across agent folders. |
| [02-profile-mode-switching](02-profile-mode-switching/README.md) | Flip `.harnessProfile` to swap frontend, backend, and security-audit modes | Switch your agent mode with one line and preview the diff first. |
| [03-team-kits](03-team-kits/README.md) | Org kits overlay the shared `.harness` source | Publish a kit once, turn it on with a selector. |
| [04-composable-instructions](04-composable-instructions/README.md) | Compose root instruction files with `.harnessRef` | `CLAUDE.md = AGENTS.md + Claude extras`. |
| [05-runtime-owned-state](05-runtime-owned-state/README.md) | `.harnessMutable` seeds runtime settings once | Seed settings, then let the runtime own them. |
| [06-layered-local-overlays](06-layered-local-overlays/README.md) | Gitignored local overlays override exact files just for one developer | Experiment locally without leaking config to the team. |
| [07-worktree-fleet-wildcards](07-worktree-fleet-wildcards/README.md) | Wildcard target parents project `.codex` into sibling worktrees | Keep every branch worktree on the same reviewed agent setup. |
| [08-monorepo-package-wildcards](08-monorepo-package-wildcards/README.md) | Wildcard resources and dir paths collect package-owned source roots | Let package teams add agent source without editing the root manifest. |

Each folder is self-contained: run commands from inside the example directory.
Generated target surfaces are gitignored, and the reviewed source lives under
`.harness`.

Prerequisite for every example: Node >= 22.12 with `npx harnessc` available.
