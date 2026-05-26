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

