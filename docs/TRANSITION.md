# Adoption Guide

HarnessConfig adoption separates durable resource definitions from live harness
folders so teams can materialize only the runtime view a harness should see.
The common greenfield flow is:

1. Inspect the repository.
2. Create `./.harness` and the standard resource roots.
3. Treat `./.agents` as the default activation projection.
4. Add `.harnessIgnore` rules for metadata, logs, and caches that should never
   enter live projections.
5. Add path-only target mappings to `harness.toml` for additional live folders.
6. Dry-run activation to review the exact projection diff.
7. Validate that the repository follows the standard.

## Plan First

```bash
harnessc plan
```

The plan is read-only. It reports live harness surfaces, missing standard
files, and the operations that would be needed.

## Apply

```bash
harnessc transition --yes
```

The transition command creates only the neutral standard structure:

```text
.harness/
  harness.toml
  skills/
  rules/
  plugins/
.harnessIgnore
```

It does not create implementation-specific state, reports, or workflow folders.
Those concepts belong to tools that build on top of HarnessConfig.

## Configure Projection

Before adding targets, decide what files should stay source-only:

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/skills/*/metadata.toml

[.claude]
.harness/plugins/*/codex-only.json
```

Add a target when another live folder should receive a projection:

```toml
[[targets]]
path = "./.claude"
```

An implementation first copies selected resources from `./.harness` into
`./.agents`, merging `.agents` overrides and skipping files matched by
`.harnessIgnore`. It then computes `./.claude` by merging `.claude` overrides
and applying global plus `.claude`-scoped ignore rules. If the computed
`./.claude` output is identical to `./.agents`, it is still materialized as its
own copy. v1 deliberately keeps projection semantics copy-only so every target
tree is inspectable without symlink-specific behavior.

## Validate

```bash
harnessc validate
```

Validation is read-only and returns a non-zero exit code when error diagnostics
are present.

## Activate

```bash
harnessc activate
harnessc activate --yes
```

Activation is a dry run unless `--yes` is supplied. The dry run shows what will
be created, updated, removed, kept, or preserved as unmanaged content for each
target. Applying activation writes the computed projection and keeps unmanaged
target entries by default.

Use `--remove-unmanaged` when the target should be cleaned to match
`./.harness`. The plan reports unmanaged entries at one level, for example
`skills/local-only` or `skills/review/local.md`, instead of expanding every
descendant file in a folder.

Use this property as the operational rule: update `./.harness`, adjust
`.harnessIgnore` or a target override when a feature should change, dry-run the
projection, then apply it. The next dry run should report unchanged projected
files plus any unmanaged entries that are intentionally preserved.

## Embedding In Other Tools

Tools should depend on `@harnessconfig/core` and use:

- `resolveHarnessPaths()` for canonical paths.
- `parseHarnessConfigToml()` for the TOML contract.
- `loadHarnessIgnoreMatcher()` for projection ignore rules.
- `validateHarnessConfig()` for read-only diagnostics.
- `planHarnessTransition()` for adoption previews.
- `applyHarnessTransition()` only when a user explicitly confirms mutation.
- `planHarnessActivation()` for activation dry-run data.
- `applyHarnessActivation()` for confirmed, idempotent live projection.
