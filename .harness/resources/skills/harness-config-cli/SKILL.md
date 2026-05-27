---
name: harness-config-cli
description: Use when working in the harness-config repository and Codex needs to validate, plan, activate, or explain Harness config dogfooding with the local @harnessconfig/cli package.
---

# Harness config CLI

## Purpose

Use this skill for this repository's own Harness config setup. The source of
truth is `.harness`; `.agents`, `.claude`, and generated root files are
projection outputs.

## Workflow

1. Work from the repository root.
2. Edit `.harness` source files, not generated target folders.
3. For standard, tooling, or test contract changes, read the matching docs
   first: `docs/STANDARD.md`, `docs/TOOLING.md`, or `docs/TESTING.md`.
4. Validate and preview the projection:

```bash
harnessc validate
harnessc plan
harnessc activate
```

5. Apply and confirm convergence:

```bash
harnessc activate --yes
harnessc activate
```

Use the repo-local build directly when the shortcut is not available:

```bash
node packages/cli/dist/bin.js validate --root .
node packages/cli/dist/bin.js activate --root .
node packages/cli/dist/bin.js activate --root . --yes
```

## Useful References

- `references/dogfood-projection.md`: source and target ownership in this repo.
- `references/activation-checks.md`: validation, activation, and convergence
  checks.

## Related Skills

- `$harness-config-specs` for standard and conformance wording.
- `$harness-config-patterns` for implementation structure.
- `$harness-config-testing` for regression coverage.
- `$harness-config-migration` for moving existing agent config into
  `.harness`.
