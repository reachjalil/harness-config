# Test Map Reference

Read this to locate the closest existing tests and helper style.

- `packages/core/test/standard.test.ts`: TOML schema, path validation, ignore
  grammar, profile grammar, and pure standard helpers.
- `packages/core/test/projection.test.ts`: resource projection, overrides,
  target-output ignores, profiles, mutable files, cleanup, symlink handling,
  action planning, and apply behavior.
- `packages/core/test/dir.test.ts`: `[dir]` copy and composition,
  `.harnessRef`, dir profile layers, dir ignores, and target merge behavior.
- `packages/core/test/docs.test.ts`: docs constraints such as keeping the
  standard implementation-neutral.
- `packages/cli/test/run.test.ts`: command behavior, dry-run semantics, exit
  codes, JSON or human output, and real CLI activation scenarios.
- `docs/TESTING.md`: scenario map. Update it when adding a new standard or CLI
  scenario.
