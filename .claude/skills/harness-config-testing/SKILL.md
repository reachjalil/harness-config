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

## Reference Map

Load the narrowest reference needed:

- `references/test-map.md`: which test file owns each behavior area.
- `references/scenario-patterns.md`: fixture shapes and assertions for common
  projection, profile, ignore, mutable, cleanup, and CLI scenarios.
## Fixture Strategy

Prefer the smallest fixture that proves the behavior. Read
`references/scenario-patterns.md` before combining resources, `[dir]`,
profiles, ignores, mutable files, cleanup, or CLI output in one test.
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

