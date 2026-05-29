---
title: Conformance
seoTitle: .harness Conformance
socialTitle: Testable conformance claims for .harness tools
description: Testable claims for repositories, resources, targets, runtime-owned mutable files, profiles, projections, path introspection, and tools.
socialDescription: Conformance criteria for repositories and tools that implement the .harness standard, including runtime-owned mutable files, profile overlays, and target-output controls.
canonicalPath: /specifications/v1/conformance/
slug: conformance
order: 6
locale: en
sectionCode: "06"
summary: Testable claims for repositories, resources, targets, runtime-owned mutable files, profiles, projections, path introspection, and tools.
llmSummary: Lists testable conformance expectations for repository shape, resource paths, target projection, runtime-owned mutable files, overrides, ignore behavior, profile overlays, extensions, activation output, and read-only path introspection.
audience: Test authors and implementers validating .harness compatibility.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config conformance

A claim of Harness config support should be testable from the file shape and
activation contract alone. A repository, tool, or organization policy may claim
support when the relevant checks below can be reproduced without depending on a
specific runtime, CLI, or hosted service.

## Conformance Levels

- Repository conformance: a repository declares `version = 1` in the selected
  repo-local manifest, keeps every declared path repo-local, and stores
  durable target resources under configured resources sources.
- Resource conformance: a resource is a file or folder under
  a configured resources source. Conventional resource items are folders
  under `<resources>/<kind>/<name>`. A target-root override appears as a
  dot-prefixed folder directly under a resources source; an item override
  appears as a dot-prefixed folder directly inside a conventional item.
  Resource files may also be composed from directories marked with
  `.harnessComposable`.
- Target conformance: a `[[targets]]` entry contains only a repo-local path.
  The matching override folder is inferred from the first path segment. No
  target may point at `.harness`, overlap a configured source root, or
  redeclare resource mappings.
- Dir conformance: each `[[dir]]` table declares one ordered repo-local dir
  source root. Directories inside that source
  marked with an empty `.harnessComposable` file are composable leaves
  whose numeric-prefix parts concatenate into one output file; all other
  directories and files copy as-is to their matching repo-relative paths.
  These outputs are separate from resource items projected into every target.
- Extension declaration conformance: an `[extensions.<id>]` table contains a
  positive integer `version`, may set `activation` to `explicit` or `auto`, and
  leaves all other fields to the extension implementation.
- Projection conformance: activation applies `.harnessIgnore` exclusions and
  `.harnessMutable` seed-only ownership rules, including source-local,
  profile-local, and target-output-local ignore files where applicable,
  distinguishes ignored files from runtime-owned mutable files, treats every
  declared target as a copy projection, and yields the same target tree for
  the same inputs, cleanup policy, and mutable policy.
- Tool conformance: an implementation reports the activation plan before
  writing, lists creates, updates, requested removals, kept files, preserved
  unmanaged entries, and mutable-skipped files, and never reads a live target
  folder as the source of truth. When a tool offers path introspection, that
  explanation is read-only and is derived from the same selected manifest,
  configured source roots, profile selectors, ignore rules, mutable rules,
  mutable policy, and projection model as activation.

## Repository Checklist

- The selected manifest exists and declares `version = 1`.
- Durable target resources live under configured resources sources.
- Conventional resource items live under `<resources>/<kind>/<name>`; direct
  resource files such as `.harness/resources/hooks.json` are allowed under any
  configured resources source.
- Resource composable leaves use a directory named for the projected file,
  an empty `.harnessComposable` marker, and numeric-prefix parts.
- Target-derived overrides appear only as dot-prefixed folders directly under
  a resources source or directly inside a conventional resource item.
- `[[targets]]` entries contain only repo-local paths.
- No target redefines resources, modes, or override names.
- No target points at `./.harness`.
- Extension ids and core extension fields validate when extensions are
  declared.
- `.harnessIgnore` patterns are repo-relative and parse cleanly.
- Global ignore sections such as `[*]` and `[global]` are recognized.
- `.harnessMutable` patterns are recognized and identify files that the source
  projection may seed once before the runtime owns the target bytes.
- If `[[dir]]` entries are declared, each dir source root resolves repo-locally and
  every composable leaf carries a `.harnessComposable` marker. Copy folders
  and individual files under dir sources carry no marker.

## Implementation Requirements

- `./.harness` MUST be treated as a conventional repository source layer, not
  an application workspace or required manifest location.
- Resource categories MUST be treated as source-tree names. `skills`, `rules`,
  `hooks`, and `plugins` are common conventions, not required schema
  categories.
- Resource kinds outside common conventions MAY be used when they live under
  configured resources sources and follow the same override contract.
- Resource composable leaves MUST project as one file at the leaf path and
  MUST NOT project their marker, `.harnessRef`, `.harnessIgnore`,
  `.harnessMutable`, or numbered part files individually.
- Overrides MUST be derived from the target path.
- The selected manifest MUST keep target entries path-only. Targets MUST NOT
  redefine resources, modes, or override names. Top-level `[[resources]]`
  and `[[dir]]` tables declare ordered source roots.
- Activation SHOULD be derived from projection.
- Activation MUST be idempotent for the same configured source trees,
  manifest, overrides, `.harnessIgnore` rules, `.harnessMutable` rules,
  cleanup choice, mutable policy, and target symlink policy.
- Implementations MUST NOT follow symlinks while discovering configured source
  roots, declared target trees, ignore files, profile selectors, or dir
  outputs.
- Implementations MUST report target symlink conflicts when a symlink occupies
  a projected path and the selected target symlink policy is `conflict`.
  Implementations MAY replace the link itself only when the selected policy is
  `replace`.
- Implementations MUST report managed target files as updates when the target
  bytes differ from the computed source projection, and applying activation
  MUST write the current source projection.
- Implementations MUST preserve unmanaged target entries by default and MUST
  require an explicit cleanup choice before removal.
- Implementations MUST support `.harnessIgnore` for global, source-local,
  profile-local, target-derived override, and target-output-local files that
  stay out of live projections. Precedence MUST use logical location and
  logical directory depth with last-matching participating rule wins.
  Profile-local files MUST evaluate at the profile overlay location,
  target-derived override files MUST evaluate at their logical source and
  target locations, and target-output `.harnessIgnore` files that already
  exist MUST remain the final boundary and be preserved during activation and
  unmanaged cleanup.
- Implementations MUST support `.harnessProfile` selectors and
  `.harnessProfileRoot` overlays. Profile roots MUST live under `./.harness`,
  a configured resources source, or a configured dir source, MUST
  be skipped as normal resource items, and MUST merge by logical source path
  for both resources and dir outputs.
- Implementations MUST support `.harnessMutable` and treat matching files as
  create-once, runtime-owned target files even when target bytes still match
  the source template. This behavior is separate from ignore behavior:
  ignored files stay out of projection, while mutable files may be projected
  when missing and preserved after creation.
- Declared target folders MUST be treated as projection outputs, not source
  repositories.
- Declared target folders MUST NOT point at `./.harness`, overlap configured
  source roots, or overlap each other.
- When `[[dir]]` entries are declared, activation MUST compose every directory with a
  `.harnessComposable` marker from its numeric-prefix parts and MUST copy
  every other directory and file under each dir source to its matching
  repo-relative path. Dir output paths that fall under a declared target
  MUST be merged into that target's projection; dir output paths that
  would replace or contain a declared target root MUST be rejected.
  Source-local `.harnessIgnore` files inside dir sources, including a
  custom dir source outside `.harness`, MUST filter dir source files.
  Target-output `.harnessIgnore` files MAY filter dir outputs by final output
  path once candidate outputs are known. Target-output `.harnessProfile`
  files MAY select profile overlays for dir outputs once candidate outputs
  are known.

## Evidence

Repository evidence is a versioned manifest, shared configured source trees,
`.harnessIgnore`, and `.harnessMutable` visible in version control when
mutable files are declared. When generated live harness surfaces are
gitignored, repository evidence should also include tracked activation
instructions that explain how to validate and regenerate those surfaces.
Profile evidence, when used, is the selected `.harnessProfile` file and
matching `.harnessProfileRoot` folders under configured source roots.

Tool evidence is a dry-run report that lists creates, updates, requested
removals, kept files, mutable-skipped files, and preserved unmanaged entries
before any write.

Projection evidence is two consecutive activations against unchanged inputs
that produce byte-identical target trees for managed files and leave mutable
files untouched after the first apply.

Mutable evidence should show the ownership transition: the first apply creates
the declared mutable file from source, a runtime edit changes the target bytes,
and a later activation reports the file as mutable without overwriting it.

Policy evidence is a CI step that runs validation against the same rules a
contributor uses locally.

Privacy evidence is simple: validation, planning, and activation can be
demonstrated from repository files without telemetry, analytics, remote error
reporting, or network access.

## Diagnostic Codes

Conforming tools SHOULD report machine-readable diagnostic codes alongside
human messages. The catalog of v1 codes is maintained in
[`./DIAGNOSTICS.md`](./DIAGNOSTICS.md). Tools that emit a `harness.*` code
MUST use a code from that catalog. Tools MAY emit codes in their own
namespace (for example `my-tool.*`) for conditions outside the standard.
