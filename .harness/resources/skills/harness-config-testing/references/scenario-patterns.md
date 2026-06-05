# Scenario Patterns Reference

Read this before adding or changing regression coverage.

## Observable Results

For a projection behavior, cover at least the observable result:

- Validate reports useful diagnostics for invalid inputs.
- Dry-run activation reports creates, updates, removes, keeps, mutable files,
  preserved unmanaged entries, or target symlink conflicts without writing.
- Apply with `--yes` writes only the desired files.
- A second dry run converges to `keep` for managed files.
- Target-output `.harnessIgnore` files are preserved during cleanup.
- `.harnessProfile` files in target output are preserved and affect only their
  subtree.
- `.harnessMutable` files are created once, then skipped unless force-mutable
  is requested.
- Target symlinks that occupy projected paths remain links unless explicit
  replacement policy is selected.

## High-Value Combined Fixtures

- `.agents` and `.claude` targets receiving the same resource with one
  target-specific override.
- A dedicated fixture for resource composables, `.harnessRef`, target
  overrides, and recipient-local `.harnessIgnore`.
- A target-output `.harnessIgnore` suppressing one target while another target
  receives the file.
- A target-local `.harnessProfile` selecting a profile overlay for only one
  output subtree.
- A `.harnessProfileIsolation` fixture with wildcard pack roots where the
  selected pack suppresses matching base resources, suppresses inactive sibling
  packs, preserves same-name local profile roots, and leaves unrelated resource
  or dir outputs active.
- A profile-isolation negation fixture where a broad isolated path such as
  `skills/**` has a deliberate shared carve-out such as `!skills/shared/**`.
- Wildcard source-root and target-parent fixtures that prove resources and dir
  roots stay repo-local, target parents may fan out externally, and
  `[[targets]].path` stays static and explicit.
- `[[dir]]` outputs that produce root files and also merge files under a
  declared target.
- Cleanup with unmanaged local files beside preserved `.harnessIgnore` and
  `.harnessProfile` selectors.

## Example Fixtures

For `examples/*`, test through the CLI rather than treating examples as static
documentation only:

- validate, dry-run, apply, assert characteristic files, and run a second dry
  activation for convergence;
- check README links and example indexes so published examples remain
  discoverable;
- verify example-local `.gitignore` rules do not hide tracked `.harness`
  source fixtures from CI;
- include profile switching when an example demonstrates isolated packs, and
  assert stale profile outputs are removed only by explicit orphan cleanup.
