---
name: harness-config-patterns
description: Use when working in the harness-config repository on implementation structure, projection architecture, resource and dir composition, target override precedence, profile and ignore integration, or deciding where code changes belong across packages/core and packages/cli.
---

# HarnessConfig Patterns

## Purpose

Use this skill for implementation design in this repository. It complements
`$harness-config-specs`: the spec says what must happen; this skill describes
how this codebase tends to model it.

## Code Map

- `packages/core/src/standard.ts`: manifest parsing, standard constants, target
  listing, and target override inference.
- `packages/core/src/validation.ts`: manifest and repository-shape
  validation diagnostics.
- `packages/core/src/ignore.ts`: `.harnessIgnore` parsing, discovery,
  precedence, target-output matching, and `[mutable]`.
- `packages/core/src/profile.ts`: `.harnessProfile` selectors,
  `.harnessProfileRoot` discovery, protected target selectors, and profile
  source overlays.
- `packages/core/src/dir.ts`: `[dir]` copy and composable output planning,
  `.harnessRef`, profile layers, and target-output profile bootstrap.
- `packages/core/src/projection.ts`: resource projection, desired target trees,
  action planning, unmanaged cleanup, mutable behavior, and apply.
- `packages/core/src/format.ts`: human-readable plan and apply output.
- `packages/cli/src/run.ts`: CLI command routing, flags, JSON mode, and exit
  codes.

## Projection Patterns

Prefer the existing projection pipeline:

1. Parse and validate the manifest.
2. Load profile context once for the activation.
3. Load ignore matcher with profile rule sets and protected target paths.
4. Build desired projections from the configured resources source for every
   declared target.
5. Plan `[dir]` outputs and merge outputs that land under declared targets.
6. Compare desired files to live target files to produce actions.
7. Apply only when requested.

Keep these path concepts separate:

- Physical source path: the real file being read.
- Logical source path: the path a profile overlay represents.
- Output relative path: path inside one target projection.
- Target output path: repo-relative path including the target root.

Most subtle bugs come from using the wrong path base in ignore, profile, or
override handling. When changing those areas, assert both the projected bytes
and the absence or preservation of filtered files.

Target override precedence:

- Canonical resource files project first.
- Target-derived override folders overlay canonical files for matching
  targets.
- Active profile roots overlay canonical layers.
- Profile target overrides can still specialize the active target after a
  profile generic overlay.
- Target-output `.harnessIgnore` remains the final boundary for the live
  target subtree.
## Composable Patterns

Composable leaves are shared by `[dir]` and resource files:

- Marker: `.harnessComposable`.
- Ref file: `.harnessRef`.
- Parts: files named like `100_intro.md`.
- Declaration files must not project as live files.
- Invalid part names, subdirectories inside a leaf, symlinks, missing refs,
  and ref cycles should produce diagnostics.

For resource composables:

- The leaf directory path is the output file path. For example,
  `.harness/resources/skills/review/SKILL.md/` projects
  `skills/review/SKILL.md`.
- Target override composables may import base composables with `.harnessRef`.
- Source-local, recipient-local, target-output-local, and profile-local
  `.harnessIgnore` rules can affect composed parts or whole composed files.

For `[dir]` composables:

- The leaf output path is repo-relative.
- Outputs under declared targets merge into the target plan.
- Outputs that replace or contain a declared target root are invalid.

## Antipatterns

- Adding compatibility for per-kind `[resources.<kind>]` declarations in v1.
- Treating `.agents`, `.claude`, or any runtime folder as source input.
- Inferring undeclared targets from folders that happen to exist.
- Using target names instead of the target path's first segment to determine
  override folders.
- Fixing tests by weakening expected behavior instead of clarifying the spec.
- Updating generated `.agents` or `.claude` dogfood files directly. Edit
  `.harness` and activate.
