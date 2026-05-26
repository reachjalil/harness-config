## Contract Map

Read the narrowest docs needed for the behavior:

- Standard semantics: `docs/STANDARD.md`.
- Conformance claims: `docs/CONFORMANCE.md`.
- CLI flags, output, dry-run behavior, and package usage: `docs/TOOLING.md`
  and `packages/cli/README.md`.
- Scenario coverage: `docs/TESTING.md`.
- Public overview language: `README.md`.

Core v1 invariants:

- Source of truth is configured source roots; live target folders are generated
  outputs.
- `./.harness/harness.toml` is the default manifest. A tool may select another
  repo-local TOML path explicitly. The manifest declares `version = 1`, an
  optional shared `[resources] path`, explicit path-only `[[targets]]`,
  optional `[dir]`, and extension declarations.
- Resources live under the configured resources source, defaulting to
  `./.harness/resources`; manifests MUST NOT contain `[resources.<kind>]`.
- Targets are never implicit. Runtime folders such as `./.agents`,
  `./.claude`, and `./.cursor` receive projection only when declared.
- Resource kinds are directory names, not schema tables. Direct files under
  the configured resources source are valid.
- Target overrides are derived from the first target path segment and appear
  as immediate dot-prefixed folders under `resources/` or inside a resource
  item.
- Resource composable leaves are directories named for the projected file
  path and marked with `.harnessComposable`; numeric parts compose into one
  target file and do not project individually.
- `.harnessRef` imports another composable leaf; `.ref` is not a standard
  filename.
- `[dir]` outputs repo-relative files from an explicit dir source. Outputs
  that land under declared targets merge into that target projection.
- `.harnessIgnore` is the projection boundary for source-local,
  target-output-local, root, and `[mutable]` rules.
- `.harnessProfile` selects profiles. `.harnessProfileRoot` must live under
  `.harness`, the configured resources source, or the configured `[dir]`
  source, is profile source only, and must not project as a resource item.
