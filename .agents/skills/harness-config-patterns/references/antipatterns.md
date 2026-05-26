# Antipatterns Reference

Read this before making compatibility, migration, or projection-architecture
changes.

- Adding compatibility for per-kind `[resources.<kind>]` declarations in v1.
- Treating `.agents`, `.claude`, or any runtime folder as source input.
- Inferring undeclared targets from folders that happen to exist.
- Using target names instead of the target path's first segment to determine
  override folders.
- Fixing tests by weakening expected behavior instead of clarifying the spec.
- Updating generated `.agents` or `.claude` dogfood files directly. Edit
  `.harness` and activate.
