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

