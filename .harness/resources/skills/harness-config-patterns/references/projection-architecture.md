# Projection Architecture Reference

Read this for implementation changes that touch activation planning, path
bases, precedence, composables, ignores, profiles, or target merging.

## Pipeline

Prefer the existing projection pipeline:

1. Parse and validate the manifest.
2. Load profile context once for the activation.
3. Load ignore matcher with profile rule sets and protected target paths.
4. Build desired projections from configured resources sources for every
   declared target.
5. Plan `[[dir]]` outputs and merge outputs that land under declared targets.
6. Compare desired files to live target files to produce actions.
7. Apply only when requested.

## Path Bases

Keep these path concepts separate:

- Physical source path: the real file being read.
- Logical source path: the path a profile overlay represents.
- Output relative path: path inside one target projection.
- Target output path: repo-relative path including the target root.
- Target parent: physical base directory for a target. It may be external, but
  override selection still comes from the target-local path.

When changing these areas, assert both projected bytes and absence or
preservation of filtered files.

## Target Override Precedence

- Canonical resource files project first.
- Generic active profile roots overlay canonical files.
- Target-derived override folders overlay canonical and generic profile files
  for matching targets.
- Profile target overrides can still specialize the active target after a
  profile generic overlay.
- Target-output `.harnessIgnore` remains the final boundary for the live target
  subtree.

## Profile Isolation

`.harnessProfileIsolation` is profile-root-local and suppresses matching
non-profile resource or dir candidates before final file selection. Match
against logical resource paths or repo-relative dir output paths, not physical
storage paths and not external target parents.

Same-name active profile roots continue to participate, including roots from
ordered source layers or wildcard-expanded pack roots. This lets a selected
portable pack and a local same-name pack compose while inactive sibling packs
and matching base/general candidates are excluded. Negated isolation patterns
are carve-outs, using the same ordered last-match model as `.harnessIgnore`.

## Composables

Composable leaves are shared by `[[dir]]` and resource files:

- Marker: `.harnessComposable`.
- Ref file: `.harnessRef`.
- Parts: files named like `100_intro.md`.
- Declaration files must not project as live files.
- Invalid part names, subdirectories inside a leaf, symlinks, missing refs, and
  ref cycles should produce diagnostics.

For resource composables:

- The leaf directory path is the output file path. For example,
  `.harness/resources/rules/review.md/` projects `rules/review.md`.
- Target override composables may import base composables with `.harnessRef`.
- Source-local, recipient-local, target-output-local, and profile-local
  `.harnessIgnore` rules can affect composed parts or whole composed files.

For `[[dir]]` composables:

- The leaf output path is repo-relative.
- Outputs under declared targets merge into the target plan.
- Outputs that replace or contain a declared target root are invalid.
