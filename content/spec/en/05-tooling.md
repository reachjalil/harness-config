---
title: Tooling
seoTitle: .harness Tooling
socialTitle: Tooling for validating and activating .harness config
description: The npx harnessc standard implementation, local validation, no-telemetry operation, runtime-owned mutable handling, profile discovery, planning, activation, and cleanup commands.
socialDescription: The command and helper layer for local .harness validation, no-telemetry activation, runtime-owned mutable files, profile overlays, and activation projections.
canonicalPath: /specifications/v1/tooling/
slug: tooling
order: 5
locale: en
sectionCode: "05"
summary: "The npx harnessc standard implementation: local validation, no-telemetry operation, runtime-owned mutable handling, profile discovery, planning, activation, and cleanup commands."
llmSummary: Describes tooling expectations for local validation, no-telemetry activation, runtime-owned mutable files, profile overlays, dry-run planning, diagnostics, cleanup, and implementation helpers around .harness.
audience: CLI authors and developers operating .harness repositories.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Harness config tooling

`npx harnessc` is the standard implementation of Harness config. It exists so
repositories can validate the file shape, preview activation, and materialize
copy projections without writing a custom tool first.

Any other implementation that meets tool conformance is equally valid. The
standard is defined by the repository shape and activation contract, not by a
single binary.

## Privacy And Telemetry

Harness config does not collect telemetry.

The `npx harnessc` CLI does not send analytics, usage events, file paths,
repository names, command history, machine identifiers, or error reports.

Activation, validation, and planning run locally against files in your
repository. The CLI does not make network requests during normal operation.

## Commands

```bash
npx harnessc
npx harnessc init
npx harnessc validate
npx harnessc explain <path>
npx harnessc activate
npx harnessc extension activate
npx harnessc plan
```

- `npx harnessc` with no command validates the nearest repository config and
  prints the detected manifest path with suggested next steps.
- `npx harnessc init` creates the selected manifest (`./.harness/harness.toml` by
  default), conventional or custom resource folders under the configured
  resources source root, and `.harnessIgnore` when applied with `--yes`. The
  generated starter manifest declares `[[resources]] path =
  "./.harness/resources"` explicitly.
- `npx harnessc validate` checks version support, repo-local paths, target
  mappings, projection ignore syntax, mutable scope syntax, resource
  composable leaves, symlink leaf handling, and dir composition/copy issues.
- `npx harnessc explain <path>` explains how a source or output path
  participates in the current projection plan, including winning source paths,
  configured source roots, dir outputs, and blocking diagnostics.
- `npx harnessc activate` dry-runs the activation projection and shows creates,
  updates, requested removals, kept files, mutable-skipped files, and preserved
  unmanaged entries before writing.
- `npx harnessc extension activate` runs registered extensions. Use
  `--extension <id>` to run one declared extension or `--all` to run every
  declared supported extension.
- `npx harnessc plan` is a read-only initialization/adoption plan. It is not a
  projection preview. Use `npx harnessc activate` without `--yes` to preview
  projection.

`init`, `activate`, and `extension activate` are dry runs unless `--yes` is
supplied.
Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match configured sources; use `--keep-unmanaged`
to make the default explicit.

Cleanup applies only to targets that are still declared in the selected
manifest. After a target declaration is removed, base `npx harnessc activate` no
longer inspects or cleans that folder. Clean it first with
`--remove-unmanaged`, or use a higher-level activation-state workflow that can
reconcile orphaned targets.

The default manifest path is `./.harness/harness.toml`. When `--root` and
`--config` are omitted, `npx harnessc` searches upward from the current
directory for that manifest. Pass `--config <path>` to validate, plan,
initialize, activate, or run extensions against a different repo-local TOML file.
`npx harnessc init --resources-path <path>` writes a
one `[[resources]]` entry into the manifest and creates resource folders below that
configured source root. Manifest paths are selected by the tool invocation;
paths inside the manifest remain repo-local, not relative to the manifest
file's directory.

The activation plan is also the operator-facing view of ownership. Managed
files are repo-owned projection outputs, unmanaged entries are existing target
state outside the projection, and mutable entries are target files seeded by
source but now owned by the runtime.

Managed files are compared directly with the current source projection: if the
target differs, `npx harnessc activate` reports `update` and applying activation
overwrites the target with the current source bytes. Mutable files declared
under `[mutable]` in `.harnessIgnore` are created once from source and skipped
on subsequent activations because the live target bytes are runtime-owned. Use
`--force-mutable` to re-project them from source.

Selection workflows, marketplace behavior, target edit review, capture, and
other product opinions belong above `npx harnessc`.

## Dir Composition And Copy

Declaring one or more `[[dir]]` entries in the selected manifest activates
ordered dir source roots. Running `npx harnessc activate` plans and applies dir
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

Inside each `[[dir]]` source, directories that contain an empty `.harnessComposable` marker
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

Dir output paths that fall under a declared `[[targets]]` path merge into
that target's projection — running activation a second time converges to
`keep` actions for those files, including target unmanaged-entry cleanup.
A dir output that would replace or contain a target root itself (for
example a dir output at `.claude` when `./.claude` is declared as a
target) is reported as `harness.dir_output_target_overlap`.

## Extensions

`npx harnessc` ships with an extension registry for forward-compatibility.
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
`npx harnessc extension activate` runs only extensions configured with
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
- Parse `.harnessIgnore` with repo-root, source-local, profile-local,
  target-output-local, and `[mutable]` rules using the standard precedence
  phases.
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
