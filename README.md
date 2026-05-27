# Harness config

[![Website](https://img.shields.io/badge/website-harnessconfig.dev-111827)](https://www.harnessconfig.dev/)
[![Specification](https://img.shields.io/badge/spec-proposal-111827)](https://www.harnessconfig.dev/specifications/v1/)
[![CI](https://github.com/reachjalil/harness-config/actions/workflows/ci.yml/badge.svg?branch=dev)](https://github.com/reachjalil/harness-config/actions/workflows/ci.yml)
[![skills.sh](https://skills.sh/b/reachjalil/harness-config)](https://skills.sh/reachjalil/harness-config)
[![npm harnessc](https://img.shields.io/npm/v/harnessc?label=harnessc)](https://www.npmjs.com/package/harnessc)
[![npm @harnessconfig/core](https://img.shields.io/npm/v/@harnessconfig/core?label=%40harnessconfig%2Fcore)](https://www.npmjs.com/package/@harnessconfig/core)
[![Security](https://img.shields.io/badge/security-policy-111827)](./SECURITY.md)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

**Status:** Specification proposal with an alpha reference implementation.
The npm package set is currently `1.0.0-alpha.2`. Treat the v1 file shape and
activation model as a public proposal while public releases, conformance
fixtures, adopter repositories, and external issue traffic mature.

The alpha TypeScript reference implementation is available as
[`@harnessconfig/core`](https://www.npmjs.com/package/@harnessconfig/core)
and the [`harnessc`](https://www.npmjs.com/package/harnessc) CLI.

Website: https://www.harnessconfig.dev/

Specification: https://www.harnessconfig.dev/specifications/v1/

Release notes: [docs/RELEASE_NOTES.md](./docs/RELEASE_NOTES.md)

Release checklist: [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md)

Contributing: [CONTRIBUTING.md](./CONTRIBUTING.md)

Development and release process: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)

## What Harness config is

Harness config is a small, repo-local specification proposal for multi-agent
configuration. It keeps durable prompts, skills, rules, and harness resources
under `.harness`, then projects them into live agent surfaces such as
`AGENTS.md`, `CLAUDE.md`, `.claude`, `.cursor`,
`.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`,
and custom targets.

The central model is explicit ownership. Reviewed source roots are
repo-owned: they hold the canonical prompts, skills, rules, hooks, and
instruction parts. Live harness surfaces are generated outputs. Files declared
under `[mutable]` cross the boundary once as seed data, then become
runtime-owned state that activation reports but does not overwrite by default.

The alpha reference CLI is intentionally boring: initialize, validate, preview,
and activate file projections with explicit targets and reviewable diffs. Both
the manifest path and resources source path can be explicit when a repository
needs a different layout.

Harness config does not collect telemetry. The `harnessc` CLI does not send
analytics, usage events, file paths, repository names, command history, machine
identifiers, or error reports. Activation, validation, and planning run locally
against files in your repository, and the CLI does not make network requests
during normal operation.

## The Problem It Solves

Repositories that work with more than one AI coding agent tend to grow
several near-duplicate harness surfaces. Codex uses `AGENTS.md`. GitHub
Copilot uses `.github/copilot-instructions.md` and
`.github/instructions/*.instructions.md`. Claude Code uses `CLAUDE.md` and
`.claude/settings*.json`. Cursor uses rules and `AGENTS.md`-style
configuration. Custom tools often add their own folders.

When one repository has more than one of these, the risk shifts from "how do I
configure the agent?" to "which file is canonical, and how do I review changes
safely?" The same prompt or skill gets copy-pasted into each surface,
runtime-written files leak into version control, and adding another agent
creates another coordination problem. Harness config replaces that pattern with
one reviewed source layout plus an explicit, reproducible projection into each
harness surface target.

That matters most when a harness both reads and writes its surface. Settings,
permission grants, allow-lists, learned commands, and local scratch state need
a place to live without pretending to be canonical source. The `[mutable]`
model lets a repository provide an initial template while making the live
target file runtime-owned after first activation.

See [docs/RATIONALE.md](./docs/RATIONALE.md) for the long form.

## Before And After

Before Harness config, multi-agent repositories tend to accumulate live
surfaces as if each one were source:

```text
.claude/
.cursor/
.agents/
.github/copilot-instructions.md
duplicate prompts
runtime state leaking into git
```

After Harness config, durable material lives in a reviewed source catalog and
activation projects it into explicit targets:

```text
.harness/resources  ->  explicit projection targets
```

.harness is an auditable source of truth, not a runtime library. It holds the
durable prompts, skills, rules, hooks, and instruction parts that should be
reviewed in Git. Live harness surfaces remain ordinary generated outputs.

The lifecycle stays local and reviewable:

```text
source  ->  validate  ->  plan  ->  activate  ->  runtime-owned state
```

Projection is customizable without making live folders canonical: declare
targets, select profile overlays, filter with `.harnessIgnore`, and mark local
settings or permission files as `[mutable]` when the runtime should own them
after the first projection.

## Why now

Coding-agent configuration is moving into repository files, but every harness
has picked a slightly different live surface. That is useful for each tool and
messy for teams using more than one tool. A repo-local projection contract lets
teams keep tool-native surfaces while reviewing shared configuration once.

## Core Properties

- **Neutral source roots** reviewed in version control, with `./.harness` as
  the default convention.
- **Explicit targets only.** A repo-local folder receives projection *only*
  when declared in the selected manifest. No implicit targets or reserved target
  folder names.
- **Configurable resources source.** `./.harness/resources` is the default,
  but `[resources] path = "./path"` can move it. `skills`, `rules`, `hooks`,
  and `plugins` are common conventions; repositories may add `prompts`,
  `workflows`, `checks`, direct files such as `hooks.json`, or any other
  durable target resource path there.
- **Copy projection.** Targets are materialized as ordinary files, not
  symlinks. The plan (`create` / `update` / `remove` / `keep` / `preserve`
  / `mutable`) is shown before any write.
- **Runtime-owned mutable files.** `[mutable]` is an ownership boundary, not
  just an exclusion. Source can seed a target file once; after that, the live
  runtime owns the target bytes until mutable re-projection is explicitly
  forced.
- **Idempotent under fixed inputs.** Given the same source tree, manifest,
  ignore rules, cleanup policy, and mutable policy, repeat activation
  converges to a `keep`-only plan for managed files and a `mutable`-only
  plan for runtime-owned files. See
  [STANDARD.md § Copy Projection](./docs/STANDARD.md#copy-projection) for
  the formal statement.
- **One projection filter** (`.harnessIgnore`) covers global,
  target-output-local, and runtime-owned (`[mutable]`) exclusions.

## Filesystem Semantics

Harness config is conservative by default because activation mutates live files:

- **Symlinks are never followed.** Symlinks under `.harness`, configured source
  roots, or declared targets are treated as leaf entries.
- **Managed files are overwritten from source.** If target bytes differ from
  the computed projection, activation reports `update` and writes source bytes
  when applied.
- **Mutable files become runtime-owned after first projection.** `[mutable]`
  files are created once from source, then treated as runtime-owned target
  state unless mutable re-projection is explicitly forced.
- **Unmanaged files are preserved by default.** Cleanup requires an explicit
  choice.
- **Target-output controls are protected local state.** Existing target-side
  `.harnessIgnore` and `.harnessProfile` files are preserved during projection
  and unmanaged cleanup.
- **Activation is deterministic for fixed inputs.** The same source tree,
  manifest, profiles, ignore rules, cleanup policy, and mutable policy produce
  the same plan.
- **Overlaps are rejected.** Targets cannot point at `.harness`, overlap
  configured source roots, or overlap each other.

## Privacy And Telemetry

Harness config does not collect telemetry.

The `harnessc` CLI does not send analytics, usage events, file paths,
repository names, command history, machine identifiers, or error reports.

Activation, validation, and planning run locally against files in your
repository. The CLI does not make network requests during normal operation.

## What Harness config is not

Harness config does not define product workflows, hosted services,
marketplaces, distribution systems, target edit review, capture, grouping,
or selection policy. Those belong in product layers that build on top of
the standard — for example, [Harnex](https://github.com/reachjalil/harnex),
which adds kits, managed activation manifests, and drift detection on top
of `@harnessconfig/core`.

## Why open source

Harness config standardizes a repository contract, not a hosted service. The
specification is defined by file shape, manifest semantics, and activation
behavior; no single binary or vendor should be the source of truth. Apache-2.0
is intended to keep adoption practical for companies, tool vendors, and open
source maintainers.

## Packages

- `@harnessconfig/core`: TypeScript schemas, version constants, path helpers,
  validation issues and warnings, ignore parsing, initialization planning, copy
  projection helpers, and the `[dir]` composable + copy module.
- `harnessc`: Publishable CLI package and one-off `npx` command.
- `@harnessconfig/cli`: Scoped implementation package used by `harnessc`.

## Quick Start

```bash
npx harnessc
npx harnessc init
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
```

With no command, `harnessc` validates the nearest repository config and prints
the detected manifest path plus the next useful commands.

Use the website and specification as the reference when asking an AI agent to
adopt the standard:

```text
Update this repository to use Harness config. Use https://www.harnessconfig.dev/
as the reference, keep reusable agent instructions under .harness, and project
explicit targets with harnessc.
```

## Layout

Default resources source:

```text
.harnessIgnore
.harness/
  harness.toml
  resources/
    hooks.json
    hooks/
      post-tool-use.sh
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
    .gemini/
      hooks.json
```

Custom resource kinds use the same shape:

```text
.harness/
  resources/
    prompts/
      incident-response/
        PROMPT.md
    workflows/
      release-check/
        workflow.toml
```

Each resource kind lives under `<resources>/<kind>`. Conventional resource
items are folders, and direct files under the resources source project to the
target root. Immediate dot-prefixed folders directly under `resources/` are
target-root overrides; immediate dot-prefixed folders inside an item are
item-level target overrides.

Resource files can also be composable leaves. For example,
`.harness/resources/skills/review/SKILL.md/.harnessComposable` composes the
numbered files inside `SKILL.md/` and projects one target file at
`skills/review/SKILL.md`.

## Manifest

The selected `harness.toml` manifest declares the supported standard version,
optional resources source path, projection targets, and optional dir source.
The default path is `./.harness/harness.toml`, and tools may select another
repo-local manifest path explicitly:

```toml
version = 1

[standard]
name = "harness-config"

[resources]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[dir]
path = "./.harness/dir"
```

Target declarations contain only `path`. A target path such as `./.claude`
automatically uses `.claude` override folders when they exist in
the configured resources source or inside a resource item. The optional
`[resources]` table may contain only `path`; omit it to use
`./.harness/resources`. The optional `[dir]` section turns on dir composition
and copy from `./.harness/dir` (or the configured path); see "Dir Composition
And Copy" below. Extensions are declared under
`[extensions.<id>]`; core owns `version` and `activation`, while each extension
owns its remaining fields.

## `.harnessIgnore`

`.harnessIgnore` is the projection boundary. Targets receive the configured
resources source by default; nested source-local and target-output-local
ignore files decide what does not enter a given subtree.
The repo-root file can match source paths such as
`.harness/resources/skills/review/logs/run.log` and target output paths such
as `.agents/skills/review/scratch.tmp`.

```text
# Global source-only state
.harness/**/logs/
.harness/**/*.log
.harness/resources/skills/*/metadata.toml

# Target-specific rules live beside the target output subtree.
# For example, .claude/plugins/.harnessIgnore can contain:
*
```

Use the selected manifest to declare targets, optional `[dir]` output sources, and
extensions. Use `.harnessIgnore` to control which files or whole subtrees are
excluded from projection.

Local `.harnessIgnore` files may also live next to source subtrees or
existing target-output subtrees:

```text
.harness/resources/skills/review/.harnessIgnore     # source-local
resources/AGENTS.md/.harnessIgnore        # custom [dir] source-local
.agents/skills/review/.harnessIgnore      # target-output-local
```

Source-local files match source paths below their directory. Target-output
files match final output paths below their directory and are preserved during
cleanup.

## Profile Overrides

Profiles let a repo keep optional overlays in configured source roots and
activate them with a small selector file:

```text
.harnessProfile                      # contains: deploy
.harness/
  resources/
    skills/
      review/SKILL.md                # normal source
      review/aggressiveProfile/
        .harnessProfileRoot          # contains: aggressive
        SKILL.md                     # overlays .harness/resources/skills/review
    deploy/                          # profile root, not a skill
      .harnessProfileRoot            # contains: deploy
      skills/review/SKILL.md         # overlays .harness/resources/skills/review
  profiles/
    personal/
      .harnessProfileRoot            # overlays .harness
      dir/AGENTS.md/100_local.md
```

`.harnessProfile` may live at the repo root or in an existing target/output
subtree such as `.agents/skills/.harnessProfile`; the nearest selector chooses
the active profile for that output path. `.harnessProfileRoot` may live under
`.harness`, the configured resources source, or the configured dir source,
cannot be nested inside another profile root, names the profile it contributes
to, and is never projected as a resource item. Profile roots nested inside
resource or dir source trees overlay their parent folder, which lets a skill
carry its own portable profile override. Profile-local `.harnessIgnore` files
match the logical overlay path, so a profile can suppress base files or
composable parts while adding its own files.

## CLI

```bash
pnpm install
pnpm build
pnpm --filter @harnessconfig/cli exec harnessc validate
pnpm --filter @harnessconfig/cli exec harnessc init
pnpm --filter @harnessconfig/cli exec harnessc activate
pnpm --filter @harnessconfig/cli exec harnessc activate --yes
pnpm --filter @harnessconfig/cli exec harnessc init --resource prompts --target ./.claude
pnpm --filter @harnessconfig/cli exec harnessc plan
```

After publishing, run the CLI through npm. During alpha, use the alpha tag:

```bash
npx harnessc@alpha validate
npx harnessc@alpha init
npx harnessc@alpha activate
npx harnessc@alpha activate --yes
npx harnessc@alpha init --yes --resource prompts --target ./runtime/agent
npx harnessc@alpha plan
```

The public CLI package is `harnessc`.

`harnessc init` writes conventional resource folders under
`.harness/resources` (`skills`, `rules`, and `plugins`) when no `--resource`
flags are supplied. Use `--resources-path <path>` to write a `[resources]`
path and create folders under a custom resources source. Use `--config <path>`
when the manifest should be somewhere other than `./.harness/harness.toml`. Passing one
or more `--resource <kind>` flags writes only those resource folders. Passing
`--target <path>` declares explicit projection targets. Init is a dry run
unless `--yes` is supplied.

`harnessc plan` is a read-only initialization/adoption plan. It is not a
projection preview, and it does not infer targets from existing folders.
Folders receive projection only after they are declared in the selected
manifest.
Run `harnessc activate` without `--yes` to preview the projection.

`harnessc activate` is also a dry run unless `--yes` is supplied. The dry run
prints the target strategy and the filesystem actions that would be taken.
Existing target entries that are not in the configured projection are kept by
default and shown as unmanaged preserved entries. Use `--remove-unmanaged` to
delete those entries during activation, or `--keep-unmanaged` to make the
preservation choice explicit.

Managed files are compared directly with the current projection. If target
bytes differ, activation reports `update` and applying activation overwrites
the target with the current source bytes. Files marked under `[mutable]` in
`.harnessIgnore` are created once and then reported as runtime-owned
`mutable` entries until `--force-mutable` is used. This keeps canonical
repo-owned content and runtime-owned state visible in the same plan without
collapsing them into the same ownership category.

Human terminal output uses ANSI color for scanability when supported, while
`--json` output remains unstyled for automation. Set `NO_COLOR` to disable
color or `FORCE_COLOR=1` to force it.

`harnessc extension activate` runs registered extensions. This release ships
no built-in extension implementations; dir composition and copy are part of
core activation when `[dir]` is declared. A dir source composes text outputs
from mirrored leaf directories:

```text
.harness/dir/
  AGENTS.md/
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .harnessRef
    150_claude.md
```

`CLAUDE.md/.harnessRef` can point to `../AGENTS.md`. Imported and local parts are
sorted together by numeric prefix and concatenated exactly, without generated
headers or separators.

Example diff summary:

```text
./.claude (copy, override .claude)
Summary: create 1, update 1, mutable 1, remove 0, keep 2, preserve unmanaged 2
Unmanaged policy: keeping existing target entries that are not in configured sources.

Creates
  - create: .claude/skills/review/SKILL.md <- .harness/resources/skills/review/.claude/SKILL.md
Updates
  - update: .claude/prompts/incident-response/PROMPT.md <- .harness/resources/prompts/incident-response/PROMPT.md
Projected files already matching
  - keep: .claude/rules/release/RULE.md <- .harness/resources/rules/release/RULE.md
Mutable target files (runtime-owned, left untouched)
  - mutable: .claude/skills/review/settings.local.json <- .harness/resources/skills/review/settings.local.json
Unmanaged target entries kept
  - preserve: .claude/skills/local-only
  - preserve: .claude/skills/review/local.md
```

## Dir Composition And Copy

Declaring `[dir]` turns on a single dir source root (default
`./.harness/dir`). `harnessc activate` runs dir composition + copy
alongside target projection.

```text
.harness/dir/
  AGENTS.md/
    .harnessComposable           # marker (empty)
    100_intro.md                 # composed into ./AGENTS.md
    200_rules.md
  CLAUDE.md/
    .harnessComposable
    .harnessRef                         # ../AGENTS.md
    150_claude.md                # composed into ./CLAUDE.md
  .claude/
    settings.json                # copy-mode -> ./.claude/settings.json
  notes/
    01_dev_intro.md              # copy-mode -> ./notes/01_dev_intro.md
```

A directory marked with an empty `.harnessComposable` file is a composable
leaf: numeric-prefix parts (`100_intro.md`, `200_rules.md`, ...) concatenate
into one output file. A directory without the marker is a copy folder; its
files copy to repo-relative paths. The marker itself never appears in any
output.

Dir outputs that fall under a declared `[[targets]]` path merge into that
target's projection, so target unmanaged-entry cleanup respects dir-owned
files. Dir outputs that would replace or contain a declared target root
are rejected.

## TypeScript API

```ts
import {
  applyHarnessActivation,
  planHarnessActivation,
  planHarnessDir,
  planHarnessInitialization,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const validation = await validateHarnessConfig(process.cwd());
const plan = await planHarnessInitialization(process.cwd());
const activationPlan = await planHarnessActivation(process.cwd());
const dryRun = await applyHarnessActivation(process.cwd());
// Plan dir composition + copy directly (requires the parsed config):
// const dirPlan = await planHarnessDir(process.cwd(), config);
```

## Quality Gate

```bash
pnpm quality
```

The quality gate runs formatting/lint checks, type checks, unit tests, builds,
and package dry-runs for every publishable package.

## Design Principles

- `./.harness` is the default durable repository-owned convention root.
- `./.harness/harness.toml` is the default manifest, and tools may select another
  repo-local TOML path explicitly.
- The resources source is configurable and defaults to `./.harness/resources`.
- Resource kinds are declarative names, not reserved schema concepts.
- `skills`, `rules`, and `plugins` are conventional init defaults.
- Every projection target is explicit in the selected manifest.
- Targets are path-only and copy-only in v1.
- Live target folders are derived projection outputs, not source repositories.
- Activation is idempotent for the same configured sources, manifest, ignore
  rules, cleanup policy, and mutable policy.
- `.harnessIgnore` is the single projection filter, with target-specific
  exclusions expressed by target-output-local files.
- `.harnessProfile` selects optional `.harnessProfileRoot` overlays without
  making live target folders source roots.
- Target override folders are derived from target paths.
- `harnessc` is local-first and explains planned changes before writing.
- `harnessc` does not collect telemetry and does not make network requests
  during normal activation, validation, or planning.

See [the rationale](./docs/RATIONALE.md),
[the standard](./docs/STANDARD.md),
[the adoption guide](./docs/ADOPTION.md),
[tooling](./docs/TOOLING.md),
[conformance](./docs/CONFORMANCE.md), and
[test matrix](./docs/TESTING.md) for details.
