# Verification

Run these checks from the repository being set up or migrated.

## Validate and preview

```bash
npx harnessc validate
npx harnessc activate
```

Expected result:

- `validate` reports no errors for the selected manifest.
- `activate` is a dry run and writes nothing.
- The plan explains creates, updates, keeps, preserved unmanaged files, mutable
  files, requested removals, and any target symlink conflicts.

## Apply and confirm convergence

```bash
npx harnessc activate --yes
npx harnessc activate
```

Expected result:

- Declared targets receive only the intended files.
- A second dry run converges to `keep` for managed files.
- Runtime-owned files declared in `.harnessMutable` are reported as `mutable` and
  are not overwritten.
- Mutable files that should exist for fresh users have an initial seed under
  `.harness`; `.harnessMutable` is not an ignore rule.
- Target symlink conflicts are resolved manually or by explicit
  `[activation].targetSymlinks = "replace"` / `--replace-target-symlinks`
  policy before apply.

## Review checklist

Inspect:

```bash
git diff -- .harness .harnessIgnore AGENTS.md CLAUDE.md .agents .claude .cursor .gemini
```

Confirm:

- durable shared source is under configured resource groups such as
  `.harness/resources` or `.harness/resources-review`,
- repo-relative generated outputs use `.harness/dir` only when useful,
- resource groups have README files when their purpose is not obvious,
- live harness surfaces are outputs, not source folders,
- target-specific differences are encoded as target-derived overrides,
- secrets and local machine settings are absent from `.harness`,
- scoped `.harnessIgnore` files protect logs, caches, generated files,
  source-only files, and output-local boundaries,
- gitignored harness surfaces can be regenerated from `.harness` plus the
  selected manifest,
- tracked activation instructions tell users and agents how to run activation
  when generated harness surfaces are gitignored.

## Explain Checks

Use `explain` for representative paths:

```bash
npx harnessc explain .harness/resources-review/skills/foo/SKILL.md --json
npx harnessc explain .agents/skills/foo/SKILL.md --json
```

Confirm ignored resources report the expected winning `.harnessIgnore` rule.
For profile or local-layer changes, confirm the explanation uses the logical
source path the user expects.

## Cleanup Checks

Before using cleanup:

```bash
npx harnessc activate --remove-unmanaged
```

Confirm every `remove` is expected. Target-output `.harnessIgnore` and
`.harnessProfile` files should be preserved. Do not use cleanup to compensate
for an unclear source layout.
