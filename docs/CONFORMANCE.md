# HarnessConfig Conformance

A claim of HarnessConfig support should be testable from the file shape and
activation contract alone. A repository, tool, or organization policy may claim
support when the relevant checks below can be reproduced without depending on a
specific runtime, CLI, or hosted service.

## Conformance Levels

- Repository conformance: a repository declares `version = 1` in
  `.harness/harness.toml`, lists at least one resource root, keeps every
  declared path repo-local, and stores resources as
  `.harness/<kind>/<name>` folders.
- Resource conformance: a resource is a folder under
  `.harness/<kind>/<name>`. Any target-derived override appears as a
  dot-prefixed folder directly inside that resource.
- Target conformance: a `[[targets]]` entry contains only a repo-local path.
  The matching override folder is inferred from the first path segment. No
  target may point at `.harness` or redeclare resource roots.
- Dir conformance: the optional `[dir]` table declares a repo-local dir
  source root (default `./.harness/dir`). Directories inside the source
  marked with an empty `.harnessComposable` file are composable leaves
  whose numeric-prefix parts concatenate into one output file; all other
  directories and files copy as-is to their matching repo-relative paths.
- Extension declaration conformance: an `[extensions.<id>]` table contains a
  positive integer `version`, may set `activation` to `explicit` or `auto`, and
  leaves all other fields to the extension implementation.
- Projection conformance: activation applies `.harnessIgnore`, including
  source-local files, target-output-local files, target-scoped sections, and
  `[mutable]` scopes, treats every declared target as a copy projection, and
  yields the same target tree for the same inputs, cleanup policy, and
  mutable policy.
- Tool conformance: an implementation reports the activation plan before
  writing, lists creates, updates, requested removals, kept files, preserved
  unmanaged entries, and mutable-skipped files, and never reads a live runtime
  folder as the source of truth.

## Repository Checklist

- `.harness/harness.toml` exists and declares `version = 1`.
- At least one resource root is declared with a repo-local path.
- Every resource lives under `.harness/<kind>/<name>`.
- Target-derived overrides appear only as dot-prefixed folders inside a
  resource.
- `[[targets]]` entries contain only repo-local paths.
- No target redefines resources, modes, or override names.
- No target points at `./.harness`.
- Extension ids and core extension fields validate when extensions are
  declared.
- `.harnessIgnore` patterns are repo-relative and parse cleanly.
- Scoped ignore sections such as `[.claude]`, `[!.cursor]`, and `[*]` are
  recognized.
- Mutable scope sections such as `[mutable]`, `[mutable .claude]`, and
  `[mutable !.cursor]` are recognized.
- If `[dir]` is declared, the dir source root resolves repo-locally and
  every composable leaf carries a `.harnessComposable` marker. Copy folders
  and individual files under the dir source carry no marker.

## Implementation Requirements

- `.harness` MUST be treated as the repository source layer, not an
  application workspace.
- Resource categories MUST be treated as declared names. `skills`, `rules`,
  and `plugins` are common conventions, not required schema categories.
- Additional resource kinds MAY be added when they live under
  `.harness/<kind>/<name>` and follow the same folder and override contract.
- Overrides MUST be derived from the target path.
- `harness.toml` MUST declare target paths only. Targets MUST NOT redefine
  resources, modes, or override names.
- Activation SHOULD be derived from projection.
- Activation MUST be idempotent for the same `.harness` tree,
  `harness.toml`, overrides, `.harnessIgnore` rules, cleanup choice, and
  mutable policy.
- Implementations MUST support `.harnessIgnore` for global, source-local,
  target-output-local, and target-scoped files that stay out of live
  projections. Target-output `.harnessIgnore` files that already exist MUST
  be preserved during activation and unmanaged cleanup.
- Implementations MUST support `[mutable]` scopes in `.harnessIgnore` and
  treat matching files as create-once, runtime-owned target files even when
  target bytes still match the source template.
- Declared target folders MUST be treated as projection outputs, not source
  repositories.
- When `[dir]` is declared, activation MUST compose every directory with a
  `.harnessComposable` marker from its numeric-prefix parts and MUST copy
  every other directory and file under the dir source to its matching
  repo-relative path. Dir output paths that fall under a declared target
  MUST be merged into that target's projection; dir output paths that
  would replace or contain a declared target root MUST be rejected.
  Source-local `.harnessIgnore` files inside the dir source, including a
  custom dir source outside `.harness`, MUST filter dir source files.
  Target-output `.harnessIgnore` files MAY filter dir outputs by final output
  path once candidate outputs are known.

## Evidence

Repository evidence is a `.harness` tree, a versioned `harness.toml`, and a
`.harnessIgnore` visible in version control.

Tool evidence is a dry-run report that lists creates, updates, requested
removals, kept files, mutable-skipped files, and preserved unmanaged entries
before any write.

Projection evidence is two consecutive activations against unchanged inputs
that produce byte-identical target trees for managed files and leave mutable
files untouched after the first apply.

Policy evidence is a CI step that runs validation against the same rules a
contributor uses locally.
