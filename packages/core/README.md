# @harnessconfig/core

Shared TypeScript implementation for the HarnessConfig standard.

## API

- `resolveHarnessPaths(root)`: returns canonical `.harness` paths.
- `parseHarnessConfigToml(raw)`: parses and validates `harness.toml`.
- `parseHarnessIgnore(raw)`: parses repo-relative `.harnessIgnore` rules.
- `loadHarnessIgnoreMatcher(root)`: loads ignore rules for projection planning.
- `listHarnessProjectionTargets(config)`: returns the default `.agents` target
  plus configured additional targets.
- `inferHarnessOverrideDirectory(path)`: derives `.claude`, `.cursor`, or
  another override folder from a target path.
- `validateHarnessConfig(root)`: returns read-only diagnostics.
- `planHarnessTransition(root)`: returns an inspectable migration plan.
- `applyHarnessTransition(root, options)`: applies confirmed transition actions.
- `planHarnessActivation(root, options)`: returns an idempotent live projection
  plan.
- `applyHarnessActivation(root, options)`: dry-runs by default and applies only
  when called with `{ yes: true }`.
- `copyHarnessResourceItemProjection(options)`: applies the same copy,
  `.harnessIgnore`, and override rules to one selected resource item.
- `harnessResourceItemProjectionMatchesTarget(options)`: checks whether one
  selected resource item already matches a live target copy.

This package does not run background services. Mutating helpers dry-run by
default and require explicit confirmation before writing activation surfaces
such as `./.agents/skills`.

Use the activation helpers when a consuming tool projects selected resources
into a live harness. Source catalogs can contain metadata, logs, or local state,
but matched files are excluded from the runtime-facing folder. Repeated
activation with the same inputs should produce the same target tree.
Unmanaged target entries are preserved by default and reported at one level;
pass `{ cleanupUnmanaged: "remove" }` to plan and apply explicit cleanup.

The core standard defines `skills`, `rules`, and `plugins` as stable resource
kinds. Workflow composition, history retention, and product-specific state are
modeled by the consuming implementation, not by HarnessConfig.
