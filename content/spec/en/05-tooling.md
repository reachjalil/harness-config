---
title: Tooling
seoTitle: .harness Tooling
socialTitle: Tooling for validating and activating .harness config
description: The npx harnessc standard implementation, local validation, explain introspection, no-telemetry operation, runtime-owned mutable handling, profile discovery, planning, activation, and cleanup commands.
socialDescription: The command and helper layer for local .harness validation, no-telemetry activation, runtime-owned mutable files, profile overlays, and activation projections.
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: en
sectionCode: "05"
summary: "The npx harnessc standard implementation: local validation, explain introspection, no-telemetry operation, runtime-owned mutable handling, profile discovery, planning, activation, and cleanup commands."
llmSummary: Describes tooling expectations for local validation, explain introspection, no-telemetry activation, runtime-owned mutable files, profile overlays, dry-run planning, diagnostics, cleanup, and implementation helpers around .harness.
audience: CLI authors and developers operating .harness repositories.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config tooling

`harnessc` is the standard implementation of Harness config. It exists so
repositories can validate the file shape, preview activation, and materialize
copy projections without writing a custom tool first.

Any other implementation that meets tool conformance is equally valid. The
standard is defined by the repository shape and activation contract, not by a
single binary.

## Privacy And Telemetry

Harness config does not collect telemetry.

The `harnessc` CLI does not send analytics, usage events, file paths,
repository names, command history, machine identifiers, or error reports.

Activation, validation, and planning run locally against files in your
repository. The CLI does not make network requests during normal operation.

## Commands

```bash
harnessc
harnessc init
harnessc validate
harnessc explain <path>
harnessc activate
harnessc extension activate
```

- `harnessc` with no command validates the nearest repository config and prints
  the detected manifest path with suggested next steps.
- `harnessc init` shows an adoption plan when run without `--yes`. With `--yes`
  it creates the selected manifest (`./.harness/harness.toml` by default),
  conventional or custom resource folders under the configured resources
  source root, `.harnessIgnore`, and `.harnessMutable`. The generated starter
  manifest declares `[[resources]] path = "./.harness/resources"` explicitly.
- `harnessc validate` checks version support, repo-local paths, target
  mappings, projection ignore syntax, mutable declaration syntax, resource
  composable leaves, symlink leaf handling, and dir composition/copy issues.
- `harnessc explain <path>` explains how a source or output path participates
  in the current projection plan, including winning source paths, configured
  source roots, dir outputs, blocking diagnostics, `.harnessIgnore`
  decisions, and `.harnessMutable` ownership decisions. JSON output includes
  source and target-output ignore traces so a caller can distinguish a
  repo-root exclusion, a deeper source-local re-include, a profile-local
  logical re-include, and a target-output final boundary.
- `harnessc activate` shows the projection preview when run without `--yes` and
  reports creates, updates, requested removals, kept files, mutable-skipped
  files, and preserved unmanaged entries. By default it reports target symlinks
  that occupy projected paths as conflicts; pass `--replace-target-symlinks` or
  set `[activation].targetSymlinks = "replace"` to replace the link itself.
- `harnessc extension activate` runs registered extensions. Use
  `--extension <id>` to run one declared extension or `--all` to run every
  declared supported extension.

`init`, `activate`, and `extension activate` are dry runs unless `--yes` is
supplied. The dry-run form of `init` replaces the previous `harnessc plan`
command, so a single mental model — "no flag previews, `--yes` writes" —
applies to every mutating command.

Common introspection examples:

```bash
harnessc explain .agents/skills/review/SKILL.md
harnessc explain AGENTS.md
harnessc explain .harness/local/resources/skills/review/SKILL.md
```

Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match configured sources; use `--keep-unmanaged`
to make the default explicit.

Generated harness surfaces such as `.agents`, `.claude`, `.cursor`, and
`.gemini` can be gitignored when they are reproducible from `.harness`.
Projects that do this should keep tracked activation instructions such as a
root instruction note, README setup step, or package script that tells users
and agents to run validation and activation on fresh checkout.

Recommended `.gitignore` entries after a complete migration are:

```gitignore
# Harness-generated live surfaces
.agents/
.claude/
.cursor/
.gemini/

# Private Harness overlays
.harness/local/
```

Keep shared Harness source tracked: `.harness/harness.toml`, shared
`.harness/resources/**`, `.harness/dir/**` when used, `.harnessIgnore`, and
`.harnessMutable` declarations. Do not add `.harness/` as a broad ignore unless
the repository intentionally opts out of sharing the source catalog.

Cleanup applies only to targets that are still declared in the selected
manifest. After a target declaration is removed, base `harnessc activate` no
longer inspects or cleans that folder. Clean it first with
`--remove-unmanaged`, or use a higher-level activation-state workflow that can
reconcile orphaned targets.

The default manifest path is `./.harness/harness.toml`. When `--root` and
`--config` are omitted, `harnessc` searches upward from the current directory
for that manifest. Pass `--config <path>` to validate, plan, initialize,
activate, or run extensions against a different repo-local TOML file.
`harnessc init --resources-path <path>` writes one `[[resources]]` entry into
the manifest and creates resource folders below that configured source root.
Manifest paths are selected by the tool invocation; paths inside the manifest
remain repo-local, not relative to the manifest file's directory.

The activation plan is also the operator-facing view of ownership. Managed
files are repo-owned projection outputs, unmanaged entries are existing target
state outside the projection, and mutable entries are target files seeded by
source but now owned by the runtime.

Managed files are compared directly with the current source projection: if the
target differs, `harnessc activate` reports `update` and applying activation
overwrites the target with the current source bytes. Mutable files declared in
`.harnessMutable` are created once from source and skipped on subsequent
activations because the live target bytes are runtime-owned. Use
`--force-mutable` to re-project them from source.

Target symlinks are not followed. If a target symlink occupies a path that
projection needs to write, `harnessc activate` reports
`harness.target_symlink_conflict` and refuses `--yes` by default. Select one of
the explicit replacement policies when replacing the link itself is intended:

```toml
[activation]
targetSymlinks = "replace"
```

or for a single run:

```bash
harnessc activate --yes --replace-target-symlinks
```

Filesystem behavior follows the v1 release freeze:

- symlinks are treated as leaf entries and are not followed;
- target symlinks that occupy projected paths are conflicts unless replacement
  is selected by manifest policy or `--replace-target-symlinks`;
- unmanaged target entries are preserved unless `--remove-unmanaged` is
  selected;
- target-output `.harnessIgnore` and `.harnessProfile` files are preserved as
  local controls;
- repeated activation with the same inputs converges to `keep` for managed
  files and `mutable` for runtime-owned files;
- overlapping targets or targets that collide with configured source roots are
  diagnostics.

Selection workflows, marketplace behavior, target edit review, capture, and
other product opinions belong above `harnessc`.

## Dir Composition And Copy

Declaring one or more `[[dir]]` entries in the selected manifest activates
ordered dir source roots. Running `harnessc activate` plans and applies dir
outputs alongside target projection:

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/dir/
  AGENTS.md/
    .harnessComposable
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .harnessComposable
    .harnessRef                       # ../AGENTS.md
    150_claude.md
  .github/
    copilot-instructions.md/
      .harnessComposable
      100_intro.md
  .claude/
    settings.json              # copy mode (no marker)
  notes/
    01_dev_intro.md            # copy mode (no marker)
```

Inside each `[[dir]]` source, directories that contain an empty
`.harnessComposable` marker
file are composable leaves: their numeric-prefix parts (for example
`100_intro.md`, `200_rules.md`) concatenate in order to produce one
repo-relative output file. Directories without the marker are copy folders:
their files and nested files copy to the matching repo-relative path.
Individual files at any depth also copy.

The same `.harnessComposable` marker can also be used under a configured
resources source. In that location it composes one projected resource file
inside each declared target; it is not a `[[dir]]` repo-relative output.

`.harnessRef` files inside a composable leaf import another leaf's parts. Imported
and local parts are sorted together, duplicate numbers keep all matching parts,
and cycles or missing `.harnessRef` targets are reported as errors.

Source-side `.harnessIgnore` rules apply during dir collection, including
rules inside a `.harnessComposable` leaf and rules inside a custom `[[dir]]`
source outside `./.harness`. Ignoring a container skips all dir outputs
below it, ignoring a leaf skips that output, and ignoring a part excludes
that part from composition. Target-output `.harnessIgnore` files can also
filter dir outputs by final output path after the candidate output structure
is known; target-output rules are evaluated after source and profile-local
rules, so they form the final boundary for that output subtree. Scoped target
headers are ignored in this mode. The `.harnessComposable` marker itself is
never copied to any output.

Profile overrides use `.harnessProfile` selectors and `.harnessProfileRoot`
source overlays. A root `.harnessProfile` applies globally; target/output
selectors such as `.agents/skills/.harnessProfile` apply only to that output
subtree. `.harnessProfileRoot` must live under `.harness`, a configured
resources source, or a configured dir source; when active, its contents
overlay either the parent source root (for markers directly inside the
resources source or dir root), the parent directory (for portable profile
roots nested inside a resource item or dir subtree), or `.harness` (for
kit-style folders).
Profile roots cannot be nested inside other profile roots. Profile-local
`.harnessIgnore` files match those logical overlay paths, including
`.harnessComposable` leaves. Dir planning discovers target/output profile
selectors from both base and profile-only candidate outputs before computing
the final dir output set.

## Single-Developer Customization

For solo developers or teams that want local experimentation without changing
reviewed shared sources, `harnessc` works with additional ordered source roots.
One practical pattern is:

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

The CLI does not require these paths to exist. Projects may choose to ignore
`.harness/local/` in version control, commit it, generate it, or use different
paths. Later roots override earlier exact-path resource or dir outputs; use
`harnessc explain <path>` to inspect why a specific source or output path is
present, ignored, overridden, or composed.

When `.harness/local/` is gitignored, shared manifests can still declare it as
an optional later root. Missing local roots simply contribute no local files;
present local roots can override exact resource or dir outputs for that
developer.

Dir output paths that fall under a declared `[[targets]]` path merge into
that target's projection — running activation a second time converges to
`keep` actions for those files, including target unmanaged-entry cleanup.
A dir output that would replace or contain a target root itself (for
example a dir output at `.claude` when `./.claude` is declared as a
target) is reported as `harness.dir_output_target_overlap`.

## Extensions

`harnessc` ships with an extension registry for forward-compatibility.
This release ships no built-in extension implementations; tools that
declare `[extensions.<id>]` for unsupported ids see an informational
diagnostic instead of behavior. The dir composition and copy surface above
is part of core activation, not an extension.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

The core standard owns `version` and `activation`. Extension-specific
fields belong to the registered extension implementation. Plain
`harnessc extension activate` runs only extensions configured with
`activation = "auto"`.

## TypeScript Helpers

Editors, CI scripts, and internal tools can embed the same behavior through
`@harnessconfig/core`:

```ts
import {
  applyHarnessActivation,
  loadHarnessIgnoreMatcher,
  parseHarnessConfigToml,
  planHarnessActivation,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const config = parseHarnessConfigToml(rawToml);
const ignore = await loadHarnessIgnoreMatcher(paths.root);
const validation = await validateHarnessConfig(paths.root);
const activationPlan = await planHarnessActivation(paths.root);
const dryRun = await applyHarnessActivation(paths.root);
```

## Validator Checks

A conforming validator should:

- Use the supplied `--root` path, or the current working directory when no root
  is supplied, as the repository root. Nested invocations should pass `--root`.
- Parse the selected manifest, defaulting to `./.harness/harness.toml`, and reject
  malformed input with clear diagnostics.
- Refuse unsupported future standard versions.
- Validate configured resources source paths and reject per-kind manifest
  resource declarations.
- Verify each `[[targets]]` entry contains only a repo-local path, points
  below the repository root, and does not overlap configured source roots.
- Parse `.harnessIgnore` with repo-root, source-local, profile-local, and
  target-output-local rules using the standard precedence phases. Parse
  `.harnessMutable` separately for create-once runtime-owned files.
- Resolve `.harnessProfile` selectors and `.harnessProfileRoot` overlays
  before projection, including the dir bootstrap/final pass for output
  selectors.
- Show create, update, remove, keep, preserve, and mutable actions before any
  write.
- Verify repeated activation against unchanged inputs converges to the same
  target tree for managed files and leaves mutable files untouched.
- Report declared targets separately from durable source folders.

## Output

The default output is a concise terminal report with paths, severity, and
suggested fixes. Human terminal output may use ANSI color for headings,
diagnostic severity, and action kinds when the output stream supports color.
Implementations should avoid color in redirected output, honor `NO_COLOR`, and
keep `--json` output free of ANSI escapes for automation and CI.
