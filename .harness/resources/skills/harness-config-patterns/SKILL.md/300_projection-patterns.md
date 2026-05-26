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
