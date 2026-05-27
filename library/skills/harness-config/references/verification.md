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
  files, and requested removals.

## Apply and confirm convergence

```bash
npx harnessc activate --yes
npx harnessc activate
```

Expected result:

- Declared targets receive only the intended files.
- A second dry run converges to `keep` for managed files.
- Runtime-owned files declared under `[mutable]` are reported as `mutable` and
  are not overwritten.

## Review checklist

Inspect:

```bash
git diff -- .harness .harnessIgnore AGENTS.md CLAUDE.md .agents .claude .cursor .gemini
```

Confirm:

- durable shared source is under `.harness/resources` or `.harness/dir`,
- live harness surfaces are outputs, not source folders,
- target-specific differences are encoded as target-derived overrides,
- secrets and local machine settings are absent from `.harness`,
- `.harnessIgnore` protects logs, caches, generated files, and mutable runtime
  files,
- gitignored harness surfaces can be regenerated from `.harness` plus the
  selected manifest.
