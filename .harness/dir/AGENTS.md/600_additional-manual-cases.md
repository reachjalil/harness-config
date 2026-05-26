## Additional Manual Cases

For changes touching validation, also create small invalid fixtures and verify
clear non-zero diagnostics for:

- unsupported `version`,
- duplicate target paths,
- absolute paths or paths containing `..`,
- targets under `./.harness`,
- target entries with fields other than `path`,
- malformed `.harnessIgnore` or `[mutable]` sections,
- `.harnessProfileRoot` outside `.harness` and the configured source roots,
- overlapping configured resources, dir, or target paths,
- non-default manifest paths selected with `--config`,
- `[dir]` `.harnessRef` cycles, missing `.harnessRef` targets, mixed
  file/directory conflicts, and target root overlaps.

For changes touching cleanup, verify both defaults:

```bash
node packages/cli/dist/bin.js activate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp" --yes --keep-unmanaged
node packages/cli/dist/bin.js activate --root "$tmp" --yes --remove-unmanaged
```

Unmanaged entries must be preserved by default and removed only when
`--remove-unmanaged` is explicit. Target-output `.harnessIgnore` files must be
preserved even during unmanaged cleanup.
