# @harnessconfig/core

[![Website](https://img.shields.io/badge/website-harnessconfig.dev-111827)](https://www.harnessconfig.dev/)
[![Specification](https://img.shields.io/badge/spec-proposal-111827)](https://www.harnessconfig.dev/specifications/v1/)
[![npm @harnessconfig/core](https://img.shields.io/npm/v/@harnessconfig/core?label=%40harnessconfig%2Fcore)](https://www.npmjs.com/package/@harnessconfig/core)
[![Security](https://img.shields.io/badge/security-policy-111827)](https://github.com/reachjalil/harness-config/security/policy)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

Alpha TypeScript reference implementation for the Harness config specification
proposal.

Harness config lets tools validate, preview, and activate repository-owned AI
agent configuration from a neutral `.harness` source tree into explicit runtime
folders, while preserving files that the runtime owns after first projection.

Website: https://www.harnessconfig.dev/

Specification: https://www.harnessconfig.dev/specifications/v1/

## API

- `resolveHarnessPaths(root, options)`: returns selected manifest,
  conventional `.harness`, and configured resources source paths.
- `parseHarnessConfigToml(raw)`: parses and validates a Harness config TOML
  manifest.
- `parseHarnessIgnore(raw)`: parses repo-relative `.harnessIgnore` rules.
- `loadHarnessIgnoreMatcher(root)`: loads ignore rules for projection planning.
- `listHarnessProjectionTargets(config)`: returns the explicitly declared
  target paths.
- `inferHarnessOverrideDirectory(path)`: derives the source override folder
  from a target path.
- `validateHarnessConfig(root)`: returns read-only issues and warnings.
- `planHarnessInitialization(root)`: returns an inspectable initialization plan.
- `applyHarnessInitialization(root, options)`: applies confirmed
  initialization actions.
- `planHarnessActivation(root, options)`: returns an idempotent copy projection
  plan for declared targets.
- `applyHarnessActivation(root, options)`: dry-runs by default and applies only
  when called with `{ yes: true }`.
- `copyHarnessResourceItemProjection(options)`: applies the same copy,
  `.harnessIgnore`, and override rules to one resource item.
- `harnessResourceItemProjectionMatchesTarget(options)`: checks whether one
  resource item already matches a target copy.
- `planHarnessDir(root, config)`: returns the dir composition + copy plan
  for configured `[[dir]]` source roots, including `.harnessComposable`
  leaves.

This package does not run background services. Mutating helpers preview by
default and require explicit confirmation before writing projection targets.
It does not collect telemetry or make network requests; callers provide the
repository files and receive validation, planning, and activation results
locally.

The manifest defaults to `./.harness/harness.toml` and may also be selected from
another repo-local path by callers that pass `configPath`. The manifest may
declare ordered `[[resources]]` source roots. If none are declared, resource
projection is disabled.

The manifest may also declare ordered `[[dir]]` source roots. When present,
`planHarnessActivation` and `applyHarnessActivation` walk those sources and
produce dir outputs:
directories carrying an empty `.harnessComposable` marker compose their
numeric-prefix parts into one output file, and any other directory or file
copies as-is to repo-relative paths. Dir outputs that fall under a declared
`[[targets]]` are merged into that target's projection; outputs that would
replace or contain a declared target root are rejected.

The manifest may also declare top-level extensions under
`[extensions.<id>]`. Core validates the shared `version` and `activation`
fields and preserves extension-owned fields for registered extension packages.

The core standard treats resource kinds as source-tree names under configured
resources sources. `skills`, `rules`, `hooks`, and `plugins` are
conventions, not reserved schema concepts, and direct files such as
`.harness/resources/hooks.json` can project to target roots when using the
default source path. Targets are explicit repo-local paths; no target folder
name is created, reserved, or projected by default.

Use the activation helpers when a consuming tool projects resource views into a
live harness. Source catalogs can contain metadata, logs, or local state, but
matched files are excluded by `.harnessIgnore`. Repeated activation with the
same inputs, cleanup policy, and mutable policy should produce the same target
tree.

`.harnessIgnore` can be repo-root, source-local under `.harness`, the
configured resources sources, or configured dir sources, or
target-output-local under existing target/output folders. Target-output rules
match final output paths and existing target-output `.harnessIgnore` files are
preserved during cleanup.

`.harnessProfile` selectors can activate `.harnessProfileRoot` overlays under
`.harness`, a configured resources source, or a configured dir source.
Active profile roots merge by logical source path for resources and dir outputs;
generic profile overlays do not beat target-specific resource overrides.
Profile-local `.harnessIgnore` files can suppress base files or composable
parts.

Unmanaged target entries are preserved by default and reported at one level;
pass `{ cleanupUnmanaged: "remove" }` to plan and apply explicit cleanup.
Files declared mutable in `.harnessIgnore` are created once from source and
skipped on later activations because the live target bytes are runtime-owned.
Managed target files that differ from the current projection are reported as
updates by direct comparison and overwritten on apply.
