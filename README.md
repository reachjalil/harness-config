# HarnessConfig

[![npm @harnessconfig/core](https://img.shields.io/npm/v/@harnessconfig/core?label=%40harnessconfig%2Fcore)](https://www.npmjs.com/package/@harnessconfig/core)
[![npm harnessc](https://img.shields.io/npm/v/@harnessconfig/cli?label=harnessc)](https://www.npmjs.com/package/@harnessconfig/cli)
[![CI](https://img.shields.io/badge/ci-pnpm%20quality-blue)](#quality-gate)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

HarnessConfig defines a small, local-first standard for repository-owned
harness resources. The standard uses `./.harness` as the neutral source root
and treats `./.agents` as the default activation target. Additional
tool-specific folders such as `./.claude`, `./.gemini`, and `./.cursor` can be
declared as path-only targets.

Activation stays simple: keep the complete, reviewable resource catalog in
`./.harness`, preview the target plan, then materialize the selected runtime
view into live harness folders as a copy projection.

The standard does not define product workflows, hosted services, distribution
systems, or runtime-specific behavior. Those belong in implementation layers.
HarnessConfig only defines the shared shape that other tools can validate and
project from, including a repo-root `.harnessIgnore` file for metadata, logs,
caches, and other files that should not enter a live harness.

## Packages

- `@harnessconfig/core`: TypeScript schemas, version constants, path helpers,
  validation diagnostics, and transition planning/apply helpers.
- `@harnessconfig/cli`: Publishable CLI package with the `harnessc` binary.

## Standard Layout

Known resource kinds:

```text
.harness/
  harness.toml
  skills/
    skill-name/
      SKILL.md
      .agents/
        SKILL.md
      .claude/
        SKILL.md
  rules/
    rule-name/
      RULE.md
  plugins/
    plugin-name/
      PLUGIN.md
.harnessIgnore
```

Extensions may add more resource kinds under `./.harness/<kind>` when they
follow the same pattern: one folder per resource and optional per-harness
override folders such as `.claude` or `.agents`.

## `harness.toml`

`harness.toml` declares the supported HarnessConfig version, resource roots,
and optional additional projection targets:

```toml
version = 1

[standard]
name = "harness-config"

[resources.skills]
path = "./.harness/skills"

[resources.rules]
path = "./.harness/rules"

[resources.plugins]
path = "./.harness/plugins"

[[targets]]
path = "./.claude"
```

The default target is always `./.agents`; it does not need to be declared.
Additional targets contain only `path`. A target path such as `./.claude`
automatically uses `.claude` override folders when they exist inside a resource
item.

## `.harnessIgnore`

`.harnessIgnore` is a repo-root ignore file for live projections. It uses
repo-relative, gitignore-style patterns so source resources can keep metadata,
logs, local caches, or implementation state without copying those files into
runtime-facing harness folders.

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/skills/*/metadata.toml

[.claude]
.harness/plugins/*/codex-only.json
```

Projection first materializes the `.agents` activation target from `.harness`,
after applying `.harnessIgnore` and any `.agents` overrides. Additional targets
are computed the same way with their target-derived override. All v1 targets
are copy projections.

Activation is idempotent. Given the same `.harness` tree, `harness.toml`, and
`.harnessIgnore`, repeated activation produces the same live target trees. A
tool should be able to show create, update, remove, keep, and preserved
unmanaged entries before writing, then converge to the same plan on the next
run.

## CLI

```bash
pnpm install
pnpm build
pnpm --filter @harnessconfig/cli exec harnessc validate
pnpm --filter @harnessconfig/cli exec harnessc plan
pnpm --filter @harnessconfig/cli exec harnessc activate
pnpm --filter @harnessconfig/cli exec harnessc activate --yes
pnpm --filter @harnessconfig/cli exec harnessc transition
pnpm --filter @harnessconfig/cli exec harnessc transition --yes
```

After publishing:

```bash
npx harnessc validate
npx harnessc plan
npx harnessc activate
npx harnessc activate --yes
npx harnessc transition
npx harnessc transition --yes
```

`harnessc activate` is a dry run unless `--yes` is supplied. The dry run prints
the target strategy and the filesystem actions that would be taken. Applying
activation writes the computed copy projection. Existing target entries that
are not in `.harness` are kept by default and shown as unmanaged preserved
entries. Use `--remove-unmanaged` to delete those entries during activation, or
`--keep-unmanaged` to make the preservation choice explicit.

`harnessc transition` and `harnessc init` are also dry runs by default. Add
`--yes` only after reviewing the planned filesystem actions.

Example diff summary:

```text
./.agents (copy, override .agents)
Summary: create 1, update 1, remove 0, keep 2, preserve unmanaged 2
Unmanaged policy: keeping existing target entries that are not in .harness.

Creates
  - create: .agents/skills/review/SKILL.md <- .harness/skills/review/SKILL.md
Updates
  - update: .agents/plugins/browser/PLUGIN.md <- .harness/plugins/browser/PLUGIN.md
Projected files already matching
  - keep: .agents/rules/release/RULE.md <- .harness/rules/release/RULE.md
Unmanaged target entries kept
  - preserve: .agents/skills/local-only (unmanaged directory kept outside .harness projection)
  - preserve: .agents/skills/review/local.md (unmanaged file kept outside .harness projection)
```

## TypeScript API

```ts
import {
  CURRENT_HARNESS_CONFIG_VERSION,
  applyHarnessActivation,
  planHarnessActivation,
  planHarnessTransition,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const validation = await validateHarnessConfig(process.cwd());
const plan = await planHarnessTransition(process.cwd());
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

- `./.harness` is the durable repository-owned root.
- `skills`, `rules`, and `plugins` are the stable standard resource kinds.
- Extension resource kinds are allowed under `./.harness/<kind>` when they
  follow the same folder and override pattern.
- Live harness folders are projection targets, not source repositories.
- `./.agents` is the default activation projection.
- Additional targets in `harness.toml` are path-only.
- Activation is selective; live harnesses receive filtered projections.
- Activation is idempotent: the same inputs produce the same target trees.
- `.harnessIgnore` controls files skipped during projection, including
  target-scoped rules.
- `harnessc` is local-first and should explain planned changes before writing.
- Implementations can add grouping, sync, and higher-level workflows on top of
  the standard without adding those concepts to HarnessConfig itself.

See [the standard](./docs/STANDARD.md),
[transition guide](./docs/TRANSITION.md), and
[test matrix](./docs/TESTING.md) for details.
