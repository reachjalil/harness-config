## Human Verification Checklist

Run this checklist before claiming the standard or CLI works end to end.

1. Read `docs/STANDARD.md` and confirm the changed behavior is defined there
   when it is part of the standard.
2. Read `docs/TOOLING.md` and `packages/cli/README.md` and confirm CLI
   behavior, flags, dry-run semantics, and output wording are documented.
3. Read `docs/CONFORMANCE.md` and confirm the repository, tool, projection,
   `[dir]`, profile, ignore, and mutable-file claims are testable.
4. Run `pnpm run quality`.
5. Run the manual fixture below and inspect the CLI output and resulting files
   as a human, not only through automated assertions.

Expected manual evidence:

- `validate` reports no diagnostics for a valid fixture.
- First `activate` without `--yes` reports creates but writes nothing.
- `activate --yes` writes declared targets and `[dir]` outputs.
- A second dry run converges to `keep` for managed files and `mutable` for
  runtime-owned files.
- `.claude` receives its `.claude` override while `.agents` receives the base
  file.
- Direct resource files project to target roots, with target-root overrides.
- Root `.harnessIgnore` excludes source logs.
- Target-output `.harnessIgnore` can filter one target while being preserved.
- `[mutable]` files are created once, then left untouched until
  `--force-mutable`.
- `[dir]` composition writes root files, follows `.harnessRef`, and merges outputs
  that land under a declared target.
- `.harnessProfile` selects a `.harnessProfileRoot` overlay for both resource
  projection and `[dir]` composition.

