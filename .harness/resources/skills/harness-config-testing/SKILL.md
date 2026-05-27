---
name: harness-config-testing
description: Use when working in the harness-config repository on test strategy, regression coverage, fixtures, docs/TESTING.md, CLI end-to-end checks, projection edge cases, profile and ignore scenarios, or focused quality commands.
---

# Harness config Testing

## Purpose

Use this skill to turn Harness config behavior into durable regression
coverage. Prefer small fixtures with explicit assertions over broad snapshots.

## References

- `references/test-map.md`: which test file owns each behavior area.
- `references/scenario-patterns.md`: fixture shapes for projection, profiles,
  ignores, mutable files, cleanup, and CLI scenarios.

## Workflow

1. Locate the closest existing test file and helper style.
2. Add the smallest fixture that proves the behavior through public APIs.
3. Assert file contents, missing files, and diagnostic codes directly.
4. Update `docs/TESTING.md` for new scenarios.
5. Run a focused test before broader checks.

Common commands:

```bash
pnpm --filter @harnessconfig/core test -- projection.test.ts
pnpm --filter @harnessconfig/core test -- dir.test.ts
pnpm --filter @harnessconfig/cli test -- run.test.ts
pnpm run quality
```

## Guardrails

- Do not use generated target files as fixture source.
- Do not skip `docs/TESTING.md` when adding a scenario.
- Do not rely on a full quality run as the only verification.
