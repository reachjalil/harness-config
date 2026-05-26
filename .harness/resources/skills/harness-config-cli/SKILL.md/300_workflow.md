## Workflow

1. Work from the repository root.
2. Read `docs/STANDARD.md`, `docs/TOOLING.md`, and `docs/TESTING.md` when
   changing the standard, CLI behavior, or test coverage.
3. Build before CLI smoke checks:

```bash
pnpm build
```

4. Use the global `harnessc` shortcut when it is available. It runs the
   current local CLI and applies commands to the directory where it is invoked:

```bash
harnessc validate
harnessc plan
harnessc activate
harnessc activate --yes
```

Use the built CLI directly from this repo when bypassing the shortcut:

```bash
node packages/cli/dist/bin.js validate --root .
node packages/cli/dist/bin.js plan --root .
node packages/cli/dist/bin.js activate --root .
node packages/cli/dist/bin.js activate --root . --yes
```

5. Re-run dry activation after applying. A clean dogfood projection should
   converge to `keep` for managed files and preserve unmanaged target files
   unless `--remove-unmanaged` is explicit.
