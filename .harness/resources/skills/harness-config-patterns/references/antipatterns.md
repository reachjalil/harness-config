# Antipatterns Reference

Read this before making compatibility, migration, or projection-architecture
changes.

- Adding compatibility for per-kind `[resources.<kind>]` declarations in v1.
- Treating `.agents`, `.claude`, or any runtime folder as source input.
- Inferring undeclared targets from folders that happen to exist.
- Using target names instead of the target path's first segment to determine
  override folders.
- Deriving overrides from `[[targets]].parent` instead of the target-local
  `path`.
- Treating wildcard `[[resources]]` or `[[dir]]` paths as permission to import
  source from outside the repository.
- Using broad root `.harnessIgnore` rules or manifest rewrites to emulate
  profile-isolated packs.
- Applying `.harnessProfileIsolation` to physical pack storage paths instead of
  logical resource or dir output paths.
- Fixing tests by weakening expected behavior instead of clarifying the spec.
- Updating generated `.agents` or `.claude` dogfood files directly. Edit
  `.harness` and activate.
