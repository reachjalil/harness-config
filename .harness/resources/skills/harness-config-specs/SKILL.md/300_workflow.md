## Spec Change Workflow

1. Classify the change:
   - Normative repository shape or activation behavior belongs in
     `docs/STANDARD.md`.
   - Testable support claims belong in `docs/CONFORMANCE.md`.
   - CLI commands, flags, package names, and human output belong in
     `docs/TOOLING.md` or package READMEs.
   - Regression scenarios belong in `docs/TESTING.md` and tests.
2. Update the normative wording before or alongside implementation changes.
3. Keep the standard implementation-neutral. Do not mention internal function
   names, package names, or CLI flags in `docs/STANDARD.md`.
4. Add or update conformance text when a new claim should be externally
   testable.
5. Add focused tests for every new or sharpened normative behavior.
6. Run focused tests, then `pnpm run quality` when the change crosses docs,
   core behavior, or CLI behavior.

Useful checks:

```bash
rg -n "\\[resources|\\.ref|harnessProfileRoot|harnessIgnore|harnessComposable" docs packages
pnpm --filter @harnessconfig/core test
pnpm --filter @harnessconfig/cli test
pnpm run quality
```

