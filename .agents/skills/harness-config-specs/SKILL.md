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

## Contract Map

Read the narrowest docs needed for the behavior:

- Standard semantics: `docs/STANDARD.md`.
- Conformance claims: `docs/CONFORMANCE.md`.
- CLI flags, output, dry-run behavior, and package usage: `docs/TOOLING.md`
  and `packages/cli/README.md`.
- Scenario coverage: `docs/TESTING.md`.
- Public overview language: `README.md`.

Core v1 invariants:

- Source of truth is configured source roots; live target folders are generated
  outputs.
- `./.harness/harness.toml` is the default manifest. A tool may select another
  repo-local TOML path explicitly. The manifest declares `version = 1`, an
  optional shared `[resources] path`, explicit path-only `[[targets]]`,
  optional `[dir]`, and extension declarations.
- Resources live under the configured resources source, defaulting to
  `./.harness/resources`; manifests MUST NOT contain `[resources.<kind>]`.
- Targets are never implicit. Runtime folders such as `./.agents`,
  `./.claude`, and `./.cursor` receive projection only when declared.
- Resource kinds are directory names, not schema tables. Direct files under
  the configured resources source are valid.
- Target overrides are derived from the first target path segment and appear
  as immediate dot-prefixed folders under `resources/` or inside a resource
  item.
- Resource composable leaves are directories named for the projected file
  path and marked with `.harnessComposable`; numeric parts compose into one
  target file and do not project individually.
- `.harnessRef` imports another composable leaf; `.ref` is not a standard
  filename.
- `[dir]` outputs repo-relative files from an explicit dir source. Outputs
  that land under declared targets merge into that target projection.
- `.harnessIgnore` is the projection boundary for source-local,
  target-output-local, root, and `[mutable]` rules.
- `.harnessProfile` selects profiles. `.harnessProfileRoot` must live under
  `.harness`, the configured resources source, or the configured `[dir]`
  source, is profile source only, and must not project as a resource item.
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

