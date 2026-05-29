## Working Rules

- Keep the standard implementation-neutral. Normative behavior belongs in
  `docs/STANDARD.md`; CLI flags and package names belong in `docs/TOOLING.md`,
  package READMEs, or tests.
- Do not make runtime folders implicit. `./.agents`, `./.claude`,
  `./.cursor`, and similar folders receive projection only when declared in
  the selected manifest.
- Preserve the one-way projection model. Source of truth is configured source
  roots; target folders are generated outputs, not source repositories.
- Use the standard filenames exactly: `.harnessIgnore`, `.harnessMutable`,
  `.harnessProfile`, `.harnessProfileRoot`, `.harnessComposable`, and
  `.harnessRef`.
- Treat `.harnessProfileRoot` as profile source only. It must live under
  `.harness`, a configured resources source, or a configured dir source, must
  not be projected as a resource item, and must overlay resources or dir
  outputs by logical source path.
- Keep `.harnessIgnore` as the projection ignore boundary for global,
  source-local, profile-local, and target-output-local rules.
- Keep `.harnessMutable` separate from `.harnessIgnore`. Mutable rules seed
  target files once from `.harness` source and then preserve runtime edits.
- Prefer focused tests near the behavior being changed. Update
  `docs/TESTING.md` when a new standard or CLI scenario is added.
