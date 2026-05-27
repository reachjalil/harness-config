# Harness config release notes

## 1.0.0-alpha.1

`1.0.0-alpha.1` is an alpha reference release for the Harness config v1
specification proposal. It is intended for early repository migrations,
tooling experiments, and public review.

### Filesystem Semantics

Harness config mutates files only through explicit activation, so the release
freezes these filesystem rules for v1:

- **Symlinks are never followed.** A symlink under `.harness`, a configured
  source root, or a declared target is treated as a leaf entry. Replace it with
  a real file or directory before relying on activation.
- **Managed files are overwritten from source.** If
  `.harness/resources/hooks.json` projects to `.agents/hooks.json` and the
  target bytes differ, activation reports `update` and writes the source bytes
  when applied.
- **Mutable files become runtime-owned after first projection.** A file matched
  by `[mutable]`, such as `.harness/resources/**/settings.local.json`, is
  created once and then skipped unless the user explicitly forces mutable
  re-projection.
- **Unmanaged files are preserved by default.** A target file such as
  `.agents/local-note.md` that is not in the computed projection is reported as
  `preserve`, not deleted, unless explicit unmanaged cleanup is selected.
- **Target-output controls are protected local state.** Existing files such as
  `.claude/skills/review/.harnessIgnore` or
  `.agents/skills/.harnessProfile` can affect that target subtree and are not
  projected over or removed by unmanaged cleanup.
- **Activation is deterministic for fixed inputs.** The same source tree,
  manifest, profiles, ignore rules, cleanup policy, and mutable policy produce
  the same plan and target tree.
- **Target overlaps are rejected.** Targets cannot point at `.harness`, overlap
  configured source roots, or overlap each other.

These rules keep live harness folders derived and reviewable while still
allowing each runtime to own its local state.
