---
name: harness-config-specs
description: Use when working in the harness-config repository on the HarnessConfig v1 standard, conformance rules, specification wording, manifest/resource/dir/profile/ignore semantics, or when deciding whether behavior belongs in docs/STANDARD.md, docs/CONFORMANCE.md, docs/TOOLING.md, README.md, or tests.
---

# HarnessConfig Specs

## Purpose

Use this skill when the task is about what HarnessConfig means, not just how
to run the CLI. Treat `docs/STANDARD.md` as the normative v1 contract,
`docs/CONFORMANCE.md` as the claim checklist, and `docs/TOOLING.md` as the
reference CLI behavior.

## Reference Map

Load the narrowest reference needed:

- `references/docs-ownership.md`: which public doc owns which kind of wording
  or behavior claim.
- `references/v1-invariants.md`: stable v1 semantics for manifests,
  resources, targets, `[dir]`, composables, ignores, and profiles.
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

## Guardrails

- Do not keep legacy behavior in a greenfield migration unless the user asks
  for compatibility.
- Do not make runtime folders implicit.
- Do not turn target folders into source repositories.
- Do not encode product selection, registries, marketplaces, or activation
  presets into v1 core semantics.
- Do not duplicate detailed CLI wording in the standard; keep CLI behavior in
  tooling docs and tests.
- When a behavior spans resources, `[dir]`, profiles, and ignore rules, update
  the spec and tests together. These features are coupled by projection.

