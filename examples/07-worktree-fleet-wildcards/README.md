# Worktree fleet wildcards

This example shows one Harness config idea unlocked by wildcard target parents:

```text
one reviewed repo source -> many sibling worktree agent folders
```

The repo keeps resources and dir source inside the example root. Activation
projects `.codex` into every matching sibling worktree under `../worktrees/*`.
The target path is still static and explicit; only the target parent is a
wildcard.

Use this pattern when a developer keeps several Git worktrees for branches but
wants the same reviewed agent setup projected into each one.

Concepts: [target parents](../../docs/STANDARD.md#targets),
[manifest path patterns](../../docs/STANDARD.md#manifest),
[resources](../../docs/STANDARD.md#resources), and
[dir source](../../docs/STANDARD.md#dir-source).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harness/                         # source humans edit
  resources/shared/               # source root, always included
  resources/branches/*/           # wildcard source roots
  dir/shared/                     # shared composed target note
  dir/branches/*/                 # wildcard dir roots

../worktrees/feature-login/.codex/       # generated external target
../worktrees/release-hardening/.codex/   # generated external target
```

## Run it

```bash
mkdir -p ../worktrees/feature-login ../worktrees/release-hardening

npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate
npx harnessc explain ../worktrees/feature-login/.codex/BRANCH_GUIDE.md --json
```

Expected result:

- `validate` reports no Harness config issues.
- The first `activate` previews writes into both sibling worktrees.
- `activate --yes` writes `.codex` under every matching `../worktrees/*`
  directory.
- `BRANCH_GUIDE.md` is composed from shared, feature, and release dir roots.
- Both worktrees receive the same static `.codex` target path.

## What just happened

Harness expanded `../worktrees/*` into concrete target parents and projected the
same explicit `.codex` target below each one. It also expanded wildcard
resources and dir source roots, so branch-specific source folders can join the
shared catalog without adding new manifest entries for every branch concern.

Try next: create `../worktrees/hotfix`, dry-run again, and inspect the new
planned `.codex` target before applying.
