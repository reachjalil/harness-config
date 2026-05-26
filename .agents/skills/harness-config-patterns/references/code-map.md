# Code Map Reference

Read this to choose the implementation owner before editing.

- `packages/core/src/standard.ts`: manifest parsing, standard constants,
  target listing, and target override inference.
- `packages/core/src/validation.ts`: manifest and repository-shape validation
  diagnostics.
- `packages/core/src/ignore.ts`: `.harnessIgnore` parsing, discovery,
  precedence, target-output matching, and `[mutable]`.
- `packages/core/src/profile.ts`: `.harnessProfile` selectors,
  `.harnessProfileRoot` discovery, protected target selectors, and profile
  source overlays.
- `packages/core/src/dir.ts`: `[dir]` copy and composable output planning,
  `.harnessRef`, profile layers, and target-output profile bootstrap.
- `packages/core/src/projection.ts`: resource projection, desired target trees,
  action planning, unmanaged cleanup, mutable behavior, and apply.
- `packages/core/src/format.ts`: human-readable plan and apply output.
- `packages/cli/src/run.ts`: CLI command routing, flags, JSON mode, and exit
  codes.
