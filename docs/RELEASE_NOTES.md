# Harness config release notes

## 1.0.0-alpha.5

`1.0.0-alpha.5` separates mutable-file ownership from ignore rules, updates
the CLI and conformance tests for that contract, and refreshes the public skill
and website guidance for safer full-repository adoption.

### Mutable Files

- Adds `.harnessMutable` as the v1 declaration file for seed-once,
  runtime-owned files.
- Keeps `.harnessIgnore` focused on projection exclusion and target-output
  filtering; legacy `[mutable]` sections in `.harnessIgnore` now produce a
  validation diagnostic.
- Supports root, source-local, profile-local, and target-derived override
  `.harnessMutable` rules with gitignore-style last-match-wins behavior.
- Keeps target-output `.harnessMutable` files out of v1 so target-local
  filtering remains a `.harnessIgnore` responsibility.

### Tooling And Tests

- Updates `harnessc init`, validation, planning, activation, and explanation
  flows to read `.harnessMutable` separately from `.harnessIgnore`.
- Preserves mutable files as create-once target state unless
  `--force-mutable` is explicit.
- Adds regression coverage for `.harnessMutable` parsing, legacy
  `.harnessIgnore` diagnostics, profile overlays, declaration-file
  non-projection, and dir/resource activation behavior.

### Adoption Guidance

- Updates the Harness config skill to version
  `2026-05-28.harness-mutable-contract` with a plan-first migration workflow,
  skill-version reporting, a full-transition checklist, and a best-practice
  review checklist.
- Clarifies that mutable files must be copied into `.harness` as seed files
  before they are declared in `.harnessMutable`.
- Clarifies that composable root files such as `AGENTS.md` should be used only
  when composition, references, profiles, or overlays are needed; otherwise
  copy the root file directly.
- Updates website and LLM prompt guidance to recommend installing the public
  Harness config skill and following the migration checklist before editing.

## 1.0.0-alpha.4

`1.0.0-alpha.4` completes the v1 ignore precedence model, tightens activation
explainability, and updates adoption guidance before the v1 proposal is treated
as final.

### Ignore And Projection Semantics

- Defines `.harnessIgnore` precedence by logical location and logical directory
  depth, with last matching participating rule winning.
- Lets deeper source-local and profile-local ignore files refine or re-include
  paths ignored by shallower rules.
- Evaluates profile-local ignore files at their logical overlay location and
  target-derived override ignore files at their logical source/target
  locations.
- Keeps target-output `.harnessIgnore` files as the final boundary that cannot
  be undone by repo, source, or profile rules.
- Keeps Harness declaration files out of projection, including
  `.harnessIgnore`, `.harnessProfile`, and `.harnessProfileRoot`.

### Tooling And Safety

- Expands `harnessc explain --json` so ignored, re-included, profile-selected,
  and target-output-filtered paths report the winning rule consistently.
- Adds explicit target symlink policy: target symlinks conflict by default and
  are replaced only when the manifest or CLI explicitly selects replacement.
- Adds coverage for resource-root ignores, profile selection across resource
  groups, target-derived override ignores, target-output final boundaries,
  synthetic declaration ignores, and idempotent activation.

### Adoption Guidance

- Updates the public Harness config skill and references with the v1 adoption
  model: resources-first, meaningful resource groups, first-class
  `.harness/local/`, scoped nested ignores, profiles as modes, and tracked
  bootstrap for gitignored generated surfaces.
- Clarifies that `AGENTS.md`, `CLAUDE.md`, and similar root files can stay as
  normal tracked files unless `[[dir]]`, composition, profiles, or local
  overlays make generation useful.
- Documents `npx skills` / skills.sh workflows, `skills-lock.json` provenance,
  and promotion of reviewed skills into `.harness` source.
- During the v1 alpha, release automation continues publishing the current
  alpha on the npm `latest` dist-tag so default `npx harnessc` resolves to the
  current proposal.

## 1.0.0-alpha.3

`1.0.0-alpha.3` updates the v1 proposal to the ordered source-root model and
adds projection introspection for reviewable customization workflows.

### Ordered Source Roots

- Replaces legacy single `[resources]` and `[dir]` manifest tables with
  ordered `[[resources]]` and `[[dir]]` source roots.
- Treats missing configured source roots as empty layers, with later roots
  overriding earlier exact-path outputs and composable leaves merging parts.
- Rejects source/target overlaps and incompatible file/folder projections
  before activation writes.

### Tooling And Docs

- Adds `harnessc explain <path>` for read-only projection introspection.
- Updates `harnessc init`, docs, package READMEs, skill guidance, and website
  specification content to use array-root examples.
- Documents optional single-developer customization layers such as
  `.harness/local/resources` and `.harness/local/dir` as recommendations, not
  standard requirements.

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
  by `.harnessMutable`, such as
  `.harness/resources/**/settings.local.json`, is created once from source and
  then skipped as runtime-owned target state unless the user explicitly forces
  mutable re-projection.
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
