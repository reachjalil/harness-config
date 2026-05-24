# Adoption Guide

HarnessConfig adoption separates durable resource definitions from live harness
folders so teams can materialize only the runtime view a target should see.

The common greenfield flow is:

1. Inspect the repository.
2. Create `./.harness`, `./.harness/harness.toml`, and `.harnessIgnore`.
3. Declare the resource roots that belong to the repository.
4. Declare every projection target explicitly.
5. Add `.harnessIgnore` rules for metadata, logs, caches, or target-specific
   exclusions.
6. Dry-run activation to review the exact projection diff.
7. Validate that the repository follows the standard.

## Plan First

```bash
harnessc plan
```

The plan is read-only. It reports missing standard files and the operations
that would be needed.

The `harnessc` reference implementation also reports known runtime surfaces,
such as `./.agents`, `./.claude`, or `./.cursor`, as advisory adoption hints.
Those folders remain ordinary directories unless they are declared as targets
in `harness.toml`.

## Initialize

```bash
harnessc init --yes
```

The default initialization creates the conventional resource roots:

```text
.harness/
  harness.toml
  skills/
  rules/
  plugins/
.harnessIgnore
```

These names are defaults, not reserved kinds. To initialize a custom source
shape, pass one or more resources and targets:

```bash
harnessc init --yes --resource prompts --resource workflows --target ./.claude
```

That writes a manifest shaped like:

```toml
version = 1

[standard]
name = "harness-config"

[resources.prompts]
path = "./.harness/prompts"

[resources.workflows]
path = "./.harness/workflows"

[[targets]]
path = "./.claude"
```

## Configure Projection

Before activating targets, decide what files should stay source-only:

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/skills/*/metadata.toml

[.claude]
.harness/plugins/**
```

Use `harness.toml` to declare resource roots and target paths. Use
`.harnessIgnore` to decide which files, folders, or entire resource kinds are
excluded from a specific target. For v1, this is clearer than adding
per-target resource maps to TOML because filtering remains in one ordered,
target-scoped rule file.

Projection copies selected resources from `./.harness` into each declared
target, merges the matching target override, and skips files matched by
`.harnessIgnore`. All v1 projections are copy-only so every target tree is
inspectable without symlink-specific behavior.

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
declared target. Applying activation writes the computed projection and keeps
unmanaged target entries by default.

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
