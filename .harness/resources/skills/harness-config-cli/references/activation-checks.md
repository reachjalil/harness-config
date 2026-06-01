# Activation Checks Reference

Read this when validating this repo's dogfood projection or explaining manual
evidence.

## Commands

Build before CLI smoke checks:

```bash
pnpm build
```

Use the repo package scripts for this repository:

```bash
pnpm run harness:activate
pnpm run harness:check
```

`harness:activate` updates the local generated outputs in place. `harness:check`
validates and proves convergence in an isolated copy because `.agents` and
`.claude` are generated, gitignored target folders and are absent on a fresh CI
checkout.

Use the shortcut when available for manual checks:

```bash
harnessc validate
harnessc activate
harnessc activate --yes
```

Bypass the shortcut with the built CLI:

```bash
node packages/cli/dist/bin.js validate --root .
node packages/cli/dist/bin.js activate --root .
node packages/cli/dist/bin.js activate --root . --yes
```

## Evidence

- `harness:check` should report no validation errors for the dogfood source.
- The checked `AGENTS.md` and `CLAUDE.md` outputs should already match the
  composed `.harness/dir` source.
- `activate --yes` should write the generated root files and declared targets.
- A second dry activation should converge to `keep` for managed files and
  `mutable` for runtime-owned files.
- Target symlink conflicts should remain blocked unless
  `[activation].targetSymlinks = "replace"` or `--replace-target-symlinks` is
  explicit.
- Generated `.agents` and `.claude` files should match `.harness` source
  intent, including target-specific overrides.
