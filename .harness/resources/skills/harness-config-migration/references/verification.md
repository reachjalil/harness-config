# Verification Reference

Read this before claiming a migration is complete.

## Checks

Run from the migrated repository root:

```bash
npx harnessc validate
npx harnessc activate
```

Inspect the dry-run output. It should explain creates and updates without
writing files.

Apply only after the plan matches the intended migration:

```bash
npx harnessc activate --yes
npx harnessc activate
```

The second dry run should converge to `keep` for managed files and `mutable`
for runtime-owned mutable files.

## Review

Check the resulting diff:

```bash
git diff -- .harness .agents .claude .cursor .gemini AGENTS.md CLAUDE.md
```

Confirm:

- root instruction outputs preserve existing guidance,
- declared runtime targets receive expected files,
- target-specific overrides project only to their target,
- local settings and secrets are absent from `.harness`,
- `.harnessIgnore` preserves runtime-owned files,
- old runtime files are removed only after generated replacements match.

## Commit Shape

Prefer a single migration commit when the repo was clean before migration. If
behavior changes are mixed in, split them from the mechanical Harness config
migration.
