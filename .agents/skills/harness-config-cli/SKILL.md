---
name: harness-config-cli
description: Use when working in the harness-config repository and Codex needs to validate, plan, activate, or explain HarnessConfig dogfooding with the local @harnessconfig/cli package. Triggers include editing .harness, projecting resources into .agents or .claude, moving AGENTS.md into dir composition, running validate/plan/activate from the repo root, or explaining how HarnessConfig projections work in this repo.
---

# HarnessConfig CLI

## Overview

Use the local `harnessc` build from this repository to validate and activate
the repo's own `.harness` tree. Treat `.harness` as source and `.agents`,
`.claude`, and root generated files as projection outputs.

## Workflow

1. Work from the repository root.
2. Read `docs/STANDARD.md`, `docs/TOOLING.md`, and `docs/TESTING.md` when
   changing the standard, CLI behavior, or test coverage.
3. Build before CLI smoke checks:

```bash
pnpm build
```

4. Use the global `harnessc` shortcut when it is available. It runs the
   current local CLI and applies commands to the directory where it is invoked:

```bash
harnessc validate
harnessc plan
harnessc activate
harnessc activate --yes
```

Use the built CLI directly from this repo when bypassing the shortcut:

```bash
node packages/cli/dist/bin.js validate --root .
node packages/cli/dist/bin.js plan --root .
node packages/cli/dist/bin.js activate --root .
node packages/cli/dist/bin.js activate --root . --yes
```

5. Re-run dry activation after applying. A clean dogfood projection should
   converge to `keep` for managed files and preserve unmanaged target files
   unless `--remove-unmanaged` is explicit.
## Reference Map

Load the narrowest reference needed:

- `references/dogfood-projection.md`: repo source/target ownership, generated
  files, skill projection shape, `.harnessRef`, and `.harnessIgnore` examples.
- `references/activation-checks.md`: validate, plan, activate, convergence,
  and manual evidence for dogfood projection checks.
## Common Tasks

When asked to explain projection in this repo, describe it concretely:

- Read `references/dogfood-projection.md` first.
- Running without `--yes` is a dry run; running with `--yes` writes outputs.
- Target folders are generated outputs and should not be edited as source.

When editing dogfood setup:

- Edit files under `.harness` first.
- Activate with the local CLI.
- Check the generated root and target files.
- Run focused tests or `pnpm run quality` when behavior or docs change.

## Companion Skills

Use these focused skills instead of loading every HarnessConfig concern into
this CLI workflow:

- `$harness-config-specs` for normative standard wording, conformance claims,
  and deciding which docs own a behavior.
- `$harness-config-patterns` for core implementation structure, projection
  precedence, composable handling, ignore/profile path bases, and code
  placement.
- `$harness-config-testing` for regression design, fixture construction,
  `docs/TESTING.md`, focused test commands, and quality gates.
