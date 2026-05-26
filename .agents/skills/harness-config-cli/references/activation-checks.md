# Activation Checks Reference

Read this when validating this repo's dogfood projection or explaining manual
evidence.

## Commands

Build before CLI smoke checks:

```bash
pnpm build
```

Use the shortcut when available:

```bash
harnessc validate
harnessc plan
harnessc activate
harnessc activate --yes
```

Bypass the shortcut with the built CLI:

```bash
node packages/cli/dist/bin.js validate --root .
node packages/cli/dist/bin.js plan --root .
node packages/cli/dist/bin.js activate --root .
node packages/cli/dist/bin.js activate --root . --yes
```

## Evidence

- `validate` should report no diagnostics for the repository.
- A dry `activate` should report intended actions without writing.
- `activate --yes` should write the generated root files and declared targets.
- A second dry activation should converge to `keep` for managed files and
  preserve unmanaged target files unless `--remove-unmanaged` is explicit.
- Generated `.agents` and `.claude` files should match `.harness` source
  intent, including target-specific overrides.
