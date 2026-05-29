# Harness config v1 Invariants Reference

Read this when changing normative behavior, conformance claims, or tests.

- Source of truth is configured source roots; live target folders are generated
  outputs.
- `./.harness/harness.toml` is the default manifest. A tool may select another
  repo-local TOML path explicitly. The manifest declares `version = 1`,
  ordered `[[resources]]` source roots, explicit path-only `[[targets]]`,
  ordered `[[dir]]` source roots, top-level activation policy, and extension
  declarations.
- Resources live under configured resources sources; manifests MUST NOT
  contain `[resources.<kind>]`.
- Targets are never implicit. Runtime folders such as `./.agents`,
  `./.claude`, and `./.cursor` receive projection only when declared.
- Target symlinks are never followed. If projection needs a path occupied by a
  target symlink, default activation reports a conflict; replacing the link
  itself requires explicit target symlink replacement policy.
- Resource kinds are directory names, not schema tables. Direct files under
  configured resources sources are valid.
- Target overrides are derived from the first target path segment and appear as
  immediate dot-prefixed folders under `resources/` or inside a resource item.
- Resource composable leaves are directories named for the projected file path
  and marked with `.harnessComposable`; numeric parts compose into one target
  file and do not project individually.
- `.harnessRef` imports another composable leaf; `.ref` is not a standard
  filename.
- `[[dir]]` outputs repo-relative files from explicit dir sources. Outputs that
  land under declared targets merge into that target projection.
- `.harnessIgnore` is the projection exclusion boundary for source-local,
  target-output-local, and root rules. `.harnessMutable` is the separate
  create-once runtime ownership boundary.
- `.harnessProfile` selects profiles. `.harnessProfileRoot` must live under
  `.harness`, a configured resources source, or a configured dir source, is
  profile source only, and must not project as a resource item.
