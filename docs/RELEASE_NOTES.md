# Harness config release notes

## 1.0.0-alpha.2

`1.0.0-alpha.2` establishes the repository release lane for the alpha package
set.

### Release Automation

- Adds GitHub Actions CI for pull requests and protected branch checks.
- Adds tag-driven npm publishing through GitHub Actions OIDC trusted
  publishing.
- Adds release tag verification so all publishable package versions and
  internal package dependency pins must match the pushed `vX.Y.Z` tag.
- Adds release-note extraction so each GitHub release uses the matching
  version section from this file.

### Project Governance

- Documents the `dev` to `main` release flow, solo-maintainer review model,
  Codex review evidence pattern, and npm trusted publisher settings.
- Adds pull request, issue, CODEOWNERS, Dependabot, and conduct files for
  open-source project hygiene.

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
  created once from source and then skipped as runtime-owned target state
  unless the user explicitly forces mutable re-projection.
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

### Privacy And Telemetry

Harness config does not collect telemetry. The `harnessc` CLI does not send
analytics, usage events, file paths, repository names, command history, machine
identifiers, or error reports. Activation, validation, and planning run locally
against files in your repository, and the CLI does not make network requests
during normal operation.
