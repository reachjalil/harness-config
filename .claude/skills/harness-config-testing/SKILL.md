---
name: harness-config-testing
description: Use when working in the harness-config repository on test strategy, regression coverage, fixtures, docs/TESTING.md, CLI end-to-end checks, projection edge cases, profile and ignore scenarios, or deciding which focused and quality commands to run.
---

# HarnessConfig Testing

## Purpose

Use this skill to turn a HarnessConfig behavior into durable regression
coverage. Prefer realistic fixtures that combine resources, `[dir]`, target
overrides, `.harnessIgnore`, profiles, mutable files, and cleanup when those
features interact in real repositories.

## Test Map

- `packages/core/test/standard.test.ts`: TOML schema, path validation,
  ignore grammar, profile grammar, and pure standard helpers.
- `packages/core/test/projection.test.ts`: resource projection, overrides,
  target-output ignores, profiles, mutable files, cleanup, symlink handling,
  action planning, and apply behavior.
- `packages/core/test/dir.test.ts`: `[dir]` copy and composition,
  `.harnessRef`, dir profile layers, dir ignores, and target merge behavior.
- `packages/core/test/docs.test.ts`: docs constraints such as keeping the
  standard implementation-neutral.
- `packages/cli/test/run.test.ts`: command behavior, dry-run semantics,
  exit codes, JSON or human output, and real CLI activation scenarios.
- `docs/TESTING.md`: scenario map. Update it when adding a new standard or
  CLI scenario.

## Scenario Patterns

For a projection behavior, cover at least the observable result:

- Validate reports useful diagnostics for invalid inputs.
- Dry-run activation reports creates, updates, removes, keeps, mutable files,
  or preserved unmanaged entries without writing.
- Apply with `--yes` writes only the desired files.
- A second dry run converges to `keep` for managed files.
- Target-output `.harnessIgnore` files are preserved during cleanup.
- `.harnessProfile` files in target output are preserved and affect only their
  subtree.
- `[mutable]` files are created once, then skipped unless force-mutable is
  requested.

High-value combined fixtures:

- `.agents` and `.claude` targets receiving the same resource with one
  target-specific override.
- A resource composable `SKILL.md/` with `.harnessRef`, a target override
  composable, and a recipient-local `.harnessIgnore`.
- A target-output `.harnessIgnore` suppressing one target while another target
  receives the file.
- A target-local `.harnessProfile` selecting a profile overlay for only one
  output subtree.
- `[dir]` outputs that produce root files and also merge files under a
  declared target.
- Cleanup with unmanaged local files beside preserved `.harnessIgnore` and
  `.harnessProfile` selectors.

## Workflow

1. Locate the closest existing test file and helper style.
2. Add the smallest fixture that proves the behavior through public APIs:
   `validateHarnessConfig`, `planHarnessActivation`,
   `applyHarnessActivation`, `planHarnessDir`, or `runHarnessConfigCli`.
3. Assert file contents and non-existence, not only action counts.
4. For diagnostics, assert stable diagnostic codes and relevant paths.
5. Update `docs/TESTING.md` with the scenario.
6. Run a focused test first, then the full quality gate for cross-cutting
   changes.

Common commands:

```bash
pnpm --filter @harnessconfig/core test -- projection.test.ts
pnpm --filter @harnessconfig/core test -- dir.test.ts
pnpm --filter @harnessconfig/cli test -- run.test.ts
pnpm run quality
```

For manual CLI fixture checks after `pnpm build`:

```bash
node packages/cli/dist/bin.js validate --root <fixture>
node packages/cli/dist/bin.js activate --root <fixture>
node packages/cli/dist/bin.js activate --root <fixture> --yes
node packages/cli/dist/bin.js activate --root <fixture>
```

## Guardrails

- Do not hide a regression behind a broad snapshot. Prefer explicit
  assertions for the files and diagnostics that matter.
- Do not skip docs updates for new scenarios; the test matrix is part of the
  project contract.
- Do not rely on generated target files as fixture source. Build fixtures
  under `.harness` and existing target-output selectors only when testing
  target-local ignore or profile behavior.
- Do not call the full quality gate as the only verification. Run focused
  tests first so failures point to the changed behavior.

