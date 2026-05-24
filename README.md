# HarnessConfig

[![npm @harnessconfig/core](https://img.shields.io/npm/v/@harnessconfig/core?label=%40harnessconfig%2Fcore)](https://www.npmjs.com/package/@harnessconfig/core)
[![npm harnessc](https://img.shields.io/npm/v/@harnessconfig/cli?label=harnessc)](https://www.npmjs.com/package/@harnessconfig/cli)
[![CI](https://img.shields.io/badge/ci-pnpm%20quality-blue)](#quality-gate)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

HarnessConfig defines a small, local-first standard for repository-owned
harness resources. A repository keeps durable resource folders under
`./.harness`, declares those resource roots in `./.harness/harness.toml`, and
declares every live projection target explicitly.

No target is implicit. `./.agents`, `./.claude`, `./.cursor`, or any other
dot-prefixed harness folder is just a target when it appears in `harness.toml`.
No resource kind is reserved. `skills`, `rules`, and `plugins` are useful
conventional defaults, but teams can declare their own kinds such as
`prompts`, `workflows`, or `checks`.

Activation stays simple: preview the target plan, apply `.harnessIgnore`, merge
the target-derived override folder when present, and materialize each declared
target as a copy projection. Given the same source tree, manifest, ignore rules,
cleanup policy, and mutable policy, repeated activation should produce the same
target trees.

HarnessConfig does not define product workflows, hosted services, marketplaces,
distribution systems, target edit review, capture, grouping, or selection
policy. Those belong in product layers that build on top of the standard.

## Packages

- `@harnessconfig/core`: TypeScript schemas, version constants, path helpers,
  validation diagnostics, ignore parsing, initialization planning, and copy
  projection helpers.
- `@harnessconfig/cli`: Publishable CLI package with the `harnessc` binary.

## Layout

Conventional resource roots:

```text
.harness/
  harness.toml
  skills/
    review/
      SKILL.md
      .claude/
        SKILL.md
  rules/
    release/
      RULE.md
  plugins/
    browser/
      PLUGIN.md
      .cursor/
        plugin.json
.harnessIgnore
```

Custom resource roots use the same shape:

```text
.harness/
  prompts/
    incident-response/
      PROMPT.md
  workflows/
    release-check/
      workflow.toml
```

Each resource kind lives under `./.harness/<kind>`. Each resource item is one
folder. Immediate dot-prefixed folders inside an item are target overrides.

## `harness.toml`

`harness.toml` declares the supported standard version, resource roots, and
projection targets:

```toml
version = 1

[standard]
name = "harness-config"

[resources.skills]
path = "./.harness/skills"

[resources.prompts]
path = "./.harness/prompts"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

Resource declarations contain only `path`. Target declarations contain only
`path`. A target path such as `./.claude` automatically uses `.claude` override
folders when they exist inside a resource item.

## `.harnessIgnore`

`.harnessIgnore` is the projection boundary. Targets receive all declared
resource roots by default; target-scoped ignore sections decide what does not
enter a given target.

```text
# Global source-only state
.harness/**/logs/
.harness/**/*.log
.harness/skills/*/metadata.toml

# Claude receives skills and prompts, but not plugins.
[.claude]
.harness/plugins/**

# Cursor receives plugins, but not prompts.
[.cursor]
.harness/prompts/**
```

Use `harness.toml` to declare what exists and where projections may write. Use
`.harnessIgnore` to control which files or whole top-level resource kinds are
excluded from a target. Keeping that boundary in one ignore file avoids a
second per-target mapping language in v1.

## CLI

```bash
pnpm install
pnpm build
pnpm --filter @harnessconfig/cli exec harnessc validate
pnpm --filter @harnessconfig/cli exec harnessc plan
pnpm --filter @harnessconfig/cli exec harnessc activate
pnpm --filter @harnessconfig/cli exec harnessc activate --yes
pnpm --filter @harnessconfig/cli exec harnessc init --resource prompts --target ./.claude
```

After publishing:

```bash
npx harnessc validate
npx harnessc plan
npx harnessc activate
npx harnessc activate --yes
npx harnessc init --yes --resource prompts --target ./.agents
```

`harnessc init` writes conventional resource roots (`skills`, `rules`, and
`plugins`) when no `--resource` flags are supplied. Passing one or more
`--resource <kind>` flags writes only those resource roots. Passing
`--target <path>` declares explicit projection targets. Init is a dry run
unless `--yes` is supplied.

`harnessc plan` may report known runtime surfaces such as `./.agents`,
`./.claude`, or `./.cursor` as standard-implementation adoption hints. Those
folders are not targets until they appear in `harness.toml`.

`harnessc activate` is also a dry run unless `--yes` is supplied. The dry run
prints the target strategy and the filesystem actions that would be taken.
Existing target entries that are not in `.harness` are kept by default and
shown as unmanaged preserved entries. Use `--remove-unmanaged` to delete those
entries during activation, or `--keep-unmanaged` to make the preservation
choice explicit.

Managed files are compared directly with the current projection. If target
bytes differ, activation reports `update` and applying activation writes the
current source bytes. Files marked under `[mutable]` in `.harnessIgnore` are
created once and then reported as runtime-owned `mutable` entries until
`--force-mutable` is used.

Example diff summary:

```text
./.claude (copy, override .claude)
Summary: create 1, update 1, mutable 1, remove 0, keep 2, preserve unmanaged 2
Unmanaged policy: keeping existing target entries that are not in .harness.

Creates
  - create: .claude/skills/review/SKILL.md <- .harness/skills/review/.claude/SKILL.md
Updates
  - update: .claude/prompts/incident-response/PROMPT.md <- .harness/prompts/incident-response/PROMPT.md
Projected files already matching
  - keep: .claude/rules/release/RULE.md <- .harness/rules/release/RULE.md
Mutable target files (runtime-owned, left untouched)
  - mutable: .claude/skills/review/settings.local.json <- .harness/skills/review/settings.local.json
Unmanaged target entries kept
  - preserve: .claude/skills/local-only
  - preserve: .claude/skills/review/local.md
```

## TypeScript API

```ts
import {
  applyHarnessActivation,
  planHarnessActivation,
  planHarnessInitialization,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const validation = await validateHarnessConfig(process.cwd());
const plan = await planHarnessInitialization(process.cwd());
const activationPlan = await planHarnessActivation(process.cwd());
const dryRun = await applyHarnessActivation(process.cwd());
```

## Quality Gate

```bash
pnpm quality
```

The quality gate runs formatting/lint checks, type checks, unit tests, builds,
and package dry-runs for every publishable package.

## Design Principles

- `./.harness` is the durable repository-owned source root.
- Resource kinds are declarative names, not reserved schema concepts.
- `skills`, `rules`, and `plugins` are conventional init defaults.
- Every projection target is explicit in `harness.toml`.
- Targets are path-only and copy-only in v1.
- Live harness folders are derived projection outputs, not source repositories.
- Activation is idempotent for the same source, manifest, ignore rules, cleanup
  policy, and mutable policy.
- `.harnessIgnore` is the single projection filter, including target-scoped
  exclusions.
- Target override folders are derived from target paths.
- `harnessc` is local-first and explains planned changes before writing.

See [the rationale](./docs/RATIONALE.md),
[the standard](./docs/STANDARD.md),
[the adoption guide](./docs/ADOPTION.md),
[tooling](./docs/TOOLING.md),
[conformance](./docs/CONFORMANCE.md), and
[test matrix](./docs/TESTING.md) for details.
