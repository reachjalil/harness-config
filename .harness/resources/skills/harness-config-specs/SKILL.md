---
name: harness-config-specs
description: Use when working in the harness-config repository on the Harness config v1 standard, conformance rules, specification wording, manifest/resource/dir/profile/ignore semantics, or docs ownership.
---

# Harness config Specs

## Purpose

Use this skill when the task is about the v1 contract: what Harness config
means, which behavior is normative, and which docs should carry the wording.

## Source Of Truth

- `docs/STANDARD.md` is the normative contract.
- `docs/CONFORMANCE.md` is the testable support checklist.
- `docs/TOOLING.md` and package READMEs describe CLI behavior.
- `docs/TESTING.md` maps scenarios to tests.

Load only the reference needed:

- `references/docs-ownership.md` for doc ownership decisions.
- `references/v1-invariants.md` for stable v1 projection rules.

## Workflow

1. Decide whether the change is normative, tooling-specific, or test-only.
2. Update the owning doc before or alongside behavior changes.
3. Keep the standard implementation-neutral.
4. Add or update conformance text when a claim should be externally testable.
5. Use focused tests for new or sharpened behavior.

Useful checks:

```bash
rg -n "harnessProfileRoot|harnessIgnore|harnessComposable|\\.harnessRef" docs packages
pnpm --filter @harnessconfig/core test
pnpm --filter @harnessconfig/cli test
```

## Guardrails

- Do not make runtime folders implicit.
- Do not turn target folders into source repositories.
- Do not encode agent product choices or registries into the v1 core contract.
- Keep CLI flags and package names out of `docs/STANDARD.md`.
