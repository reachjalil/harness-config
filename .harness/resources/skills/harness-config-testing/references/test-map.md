# Test Map Reference

Read this to locate the closest existing tests and helper style.

- `packages/core/test/standard.test.ts`: TOML schema, path validation, ignore
  grammar, profile grammar, wildcard manifest expansion, target parent
  validation, `.harnessProfileIsolation` validation, and pure standard helpers.
- `packages/core/test/projection.test.ts`: resource projection, overrides,
  target-output ignores, profiles, mutable files, cleanup, symlink handling,
  target symlink policy, profile isolation for resources, wildcard target
  fanout, action planning, and apply behavior.
- `packages/core/test/dir.test.ts`: `[[dir]]` copy and composition,
  `.harnessRef`, dir profile layers, profile isolation for dir outputs, dir
  ignores, and target merge behavior.
- `packages/core/test/docs.test.ts`: docs constraints such as keeping the
  standard implementation-neutral.
- `packages/core/test/locales.test.ts`: translated website spec parity for
  headings, fenced code, identifiers, diagnostic codes, flags, and RFC 2119
  keywords.
- `packages/cli/test/run.test.ts`: command behavior, dry-run semantics, exit
  codes, JSON or human output, symlink replacement flags, and real CLI
  activation scenarios.
- `packages/cli/test/examples.test.ts`: documented example mini-repos,
  example README links, example-local `.gitignore` guardrails, wildcard source
  and target-parent examples, and profile-isolated pack examples.
- `docs/TESTING.md`: scenario map. Update it when adding a new standard or CLI
  scenario.
