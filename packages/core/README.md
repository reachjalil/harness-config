# @harnessconfig/core

Shared TypeScript implementation for the HarnessConfig standard.

## API

- `resolveHarnessPaths(root)`: returns canonical `.harness` paths.
- `parseHarnessConfigToml(raw)`: parses and validates `harness.toml`.
- `parseHarnessIgnore(raw)`: parses repo-relative `.harnessIgnore` rules.
- `loadHarnessIgnoreMatcher(root)`: loads ignore rules for projection planning.
- `listHarnessProjectionTargets(config)`: returns the explicitly declared
  target paths.
- `inferHarnessOverrideDirectory(path)`: derives `.claude`, `.cursor`,
  `.agents`, or another override folder from a target path.
- `validateHarnessConfig(root)`: returns read-only diagnostics.
- `planHarnessInitialization(root)`: returns an inspectable initialization plan.
- `applyHarnessInitialization(root, options)`: applies confirmed initialization actions.
- `planHarnessActivation(root, options)`: returns an idempotent copy projection
  plan for declared targets.
- `applyHarnessActivation(root, options)`: dry-runs by default and applies only
  when called with `{ yes: true }`.
- `copyHarnessResourceItemProjection(options)`: applies the same copy,
  `.harnessIgnore`, and override rules to one resource item.
- `harnessResourceItemProjectionMatchesTarget(options)`: checks whether one
  resource item already matches a target copy.
- `planHarnessDir(root, config)`: returns the dir composition + copy plan
  for the `[dir]` source root, including `.harnessComposable` leaves.

This package does not run background services. Mutating helpers dry-run by
default and require explicit confirmation before writing projection targets.

`harness.toml` may also declare an optional `[dir]` source root. When
present (default path `./.harness/dir`), `planHarnessActivation` and
`applyHarnessActivation` walk that source and produce dir outputs:
directories carrying an empty `.harnessComposable` marker compose their
numeric-prefix parts into one output file, and any other directory or file
copies as-is to repo-relative paths. Dir outputs that fall under a declared
`[[targets]]` are merged into that target's projection; outputs that would
replace or contain a declared target root are rejected.

`harness.toml` may also declare top-level extensions under
`[extensions.<id>]`. Core validates the shared `version` and `activation`
fields and preserves extension-owned fields for registered extension packages.

The core standard treats resource kinds as declared names. `skills`, `rules`,
and `plugins` are conventional initialization defaults, not reserved schema
concepts. Targets are also explicit: `./.agents` is valid when declared, but it
is not created or projected by default.

Use the activation helpers when a consuming tool projects resource views into a
live harness. Source catalogs can contain metadata, logs, or local state,
but matched files are excluded by `.harnessIgnore`. Repeated activation with
the same inputs, cleanup policy, and mutable policy should produce the same
target tree.
`.harnessIgnore` can be repo-root, source-local under declared source roots,
or target-output-local under existing target/output folders. Target-output
rules match final output paths and existing target-output `.harnessIgnore`
files are preserved during cleanup.
Unmanaged target entries are preserved by default and reported at one level;
pass `{ cleanupUnmanaged: "remove" }` to plan and apply explicit cleanup.
Files declared mutable in `.harnessIgnore` are created once and skipped on
later activations. Managed target files that differ from the current projection
are reported as updates by direct comparison.
