# Harness config Conformance

A claim of Harness config support should be testable from the file shape and
activation contract alone. A repository, tool, or organization policy may claim
support when the relevant checks below can be reproduced without depending on a
specific runtime, CLI, or hosted service.

## Conformance Levels

- Repository conformance: a repository declares `version = 1` in the selected
  repo-local manifest, keeps every declared path repo-local, and stores
  durable target resources under the configured resources source.
- Resource conformance: a resource is a file or folder under
  the configured resources source. Conventional resource items are folders
  under `<resources>/<kind>/<name>`. A target-root override appears as a
  dot-prefixed folder directly under the resources source; an item override
  appears as a dot-prefixed folder directly inside a conventional item.
  Resource files may also be composed from directories marked with
  `.harnessComposable`.
- Target conformance: a `[[targets]]` entry contains only a repo-local path.
  The matching override folder is inferred from the first path segment. No
  target may point at `.harness`, overlap a configured source root, or
  redeclare resource mappings.
- Dir conformance: the optional `[dir]` table declares a repo-local dir
  source root (default `./.harness/dir`). Directories inside the source
  marked with an empty `.harnessComposable` file are composable leaves
  whose numeric-prefix parts concatenate into one output file; all other
  directories and files copy as-is to their matching repo-relative paths.
- Extension declaration conformance: an `[extensions.<id>]` table contains a
  positive integer `version`, may set `activation` to `explicit` or `auto`, and
  leaves all other fields to the extension implementation.
- Projection conformance: activation applies `.harnessIgnore`, including
  source-local files, target-output-local files, and `[mutable]` scopes,
  treats every declared target as a copy projection, and yields the same
  target tree for the same inputs, cleanup policy, and mutable policy.
- Tool conformance: an implementation reports the activation plan before
  writing, lists creates, updates, requested removals, kept files, preserved
  unmanaged entries, and mutable-skipped files, and never reads a live target
  folder as the source of truth.

## Repository Checklist

- The selected manifest exists and declares `version = 1`.
- Durable target resources live under the configured resources source.
- Conventional resource items live under `<resources>/<kind>/<name>`; direct
  resource files such as `.harness/resources/hooks.json` are allowed when the
  default resources path is used.
- Resource composable leaves use a directory named for the projected file,
  an empty `.harnessComposable` marker, and numeric-prefix parts.
- Target-derived overrides appear only as dot-prefixed folders directly under
  the resources source or directly inside a conventional resource item.
- `[[targets]]` entries contain only repo-local paths.
- No target redefines resources, modes, or override names.
- No target points at `./.harness`.
- Extension ids and core extension fields validate when extensions are
  declared.
- `.harnessIgnore` patterns are repo-relative and parse cleanly.
- Global ignore sections such as `[*]` and `[global]` are recognized.
- Mutable sections such as `[mutable]` are recognized.
- If `[dir]` is declared, the dir source root resolves repo-locally and
  every composable leaf carries a `.harnessComposable` marker. Copy folders
  and individual files under the dir source carry no marker.

## Implementation Requirements

- `./.harness` MUST be treated as a conventional repository source layer, not
  an application workspace or required manifest location.
- Resource categories MUST be treated as source-tree names. `skills`, `rules`,
  `hooks`, and `plugins` are common conventions, not required schema
  categories.
- Resource kinds outside common conventions MAY be used when they live under
  the configured resources source and follow the same override contract.
- Resource composable leaves MUST project as one file at the leaf path and
  MUST NOT project their marker, `.harnessRef`, `.harnessIgnore`, or numbered
  part files individually.
- Overrides MUST be derived from the target path.
- The selected manifest MUST keep target entries path-only. Targets MUST NOT
  redefine resources, modes, or override names. The top-level `[resources]`
  table MAY declare only the shared resources source path.
- Activation SHOULD be derived from projection.
- Activation MUST be idempotent for the same configured source trees,
  manifest, overrides, `.harnessIgnore` rules, cleanup choice, and mutable
  policy.
- Implementations MUST support `.harnessIgnore` for global, source-local, and
  target-output-local files that stay out of live projections. Target-output
  `.harnessIgnore` files that already exist MUST be preserved during
  activation and unmanaged cleanup.
- Implementations MUST support `.harnessProfile` selectors and
  `.harnessProfileRoot` overlays. Profile roots MUST live under `./.harness`,
  the configured resources source, or the configured `[dir]` source root, MUST
  be skipped as normal resource items, and MUST merge by logical source path
  for both resources and `[dir]` outputs.
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
  path once candidate outputs are known. Target-output `.harnessProfile`
  files MAY select profile overlays for dir outputs once candidate outputs
  are known.

## Evidence

Repository evidence is a versioned manifest, configured source trees, and a
`.harnessIgnore` visible in version control. Profile evidence, when used, is
the selected `.harnessProfile` file and matching `.harnessProfileRoot`
folders under configured source roots.

Tool evidence is a dry-run report that lists creates, updates, requested
removals, kept files, mutable-skipped files, and preserved unmanaged entries
before any write.

Projection evidence is two consecutive activations against unchanged inputs
that produce byte-identical target trees for managed files and leave mutable
files untouched after the first apply.

Policy evidence is a CI step that runs validation against the same rules a
contributor uses locally.
