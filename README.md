# HarnessConfig

[![npm @harnessconfig/core](https://img.shields.io/npm/v/@harnessconfig/core?label=%40harnessconfig%2Fcore)](https://www.npmjs.com/package/@harnessconfig/core)
[![npm harnessc](https://img.shields.io/npm/v/@harnessconfig/cli?label=harnessc)](https://www.npmjs.com/package/@harnessconfig/cli)
[![CI](https://img.shields.io/badge/ci-pnpm%20quality-blue)](#quality-gate)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

**Status:** Standard v1 — stable. Reference implementation is published as
[`@harnessconfig/core`](https://www.npmjs.com/package/@harnessconfig/core)
and the [`harnessc`](https://www.npmjs.com/package/@harnessconfig/cli) CLI.

## What HarnessConfig Is

A small, repository-local standard that gives multiple AI coding agents
(Claude, Cursor, Copilot, custom in-house tools) one shared way to read and
update the prompts, skills, rules, and plugins a repository owns — without
turning each agent's runtime folder into the source of truth.

A repository keeps its durable source material under one folder, `./.harness`,
declares the resource roots and runtime targets in `./.harness/harness.toml`,
and lets tools materialize each target as a reviewable copy projection.

## The Problem It Solves

Repositories that work with more than one AI coding agent tend to grow
several near-duplicate runtime folders (`.claude/`, `.cursor/`, `.agents/`,
`.codeium/`, plus root-level `AGENTS.md`, `CLAUDE.md`,
`copilot-instructions.md`). The same prompt or skill gets copy-pasted into
each, runtime-written files (permissions, learned commands) leak into version
control, and there is no clean way to add a new agent without another
folder. HarnessConfig replaces that pattern with one canonical source layout
plus an explicit, reproducible projection into each runtime target.

See [docs/RATIONALE.md](./docs/RATIONALE.md) for the long form.

## Core Properties

- **One source root** (`./.harness`), reviewed in version control.
- **Explicit targets only.** A repo-local folder receives projection *only*
  when declared in `harness.toml`. No implicit targets or reserved target
  folder names.
- **No reserved resource kinds.** `skills`, `rules`, and `plugins` are
  common conventions; repositories may declare `prompts`, `workflows`,
  `checks`, or any other kind under `./.harness/<kind>/`.
- **Copy projection.** Targets are materialized as ordinary files, not
  symlinks. The plan (`create` / `update` / `remove` / `keep` / `preserve`
  / `mutable`) is shown before any write.
- **Idempotent under fixed inputs.** Given the same source tree, manifest,
  ignore rules, cleanup policy, and mutable policy, repeat activation
  converges to a `keep`-only plan for managed files and a `mutable`-only
  plan for runtime-owned files. See
  [STANDARD.md § Copy Projection](./docs/STANDARD.md#copy-projection) for
  the formal statement.
- **One projection filter** (`.harnessIgnore`) covers global,
  target-output-local, and runtime-owned (`[mutable]`) exclusions.

## What HarnessConfig Is Not

HarnessConfig does not define product workflows, hosted services,
marketplaces, distribution systems, target edit review, capture, grouping,
or selection policy. Those belong in product layers that build on top of
the standard — for example, [Harnex](https://github.com/reachjalil/harnex),
which adds kits, managed activation manifests, and drift detection on top
of `@harnessconfig/core`.

## Packages

- `@harnessconfig/core`: TypeScript schemas, version constants, path helpers,
  validation diagnostics, ignore parsing, initialization planning, copy
  projection helpers, and the `[dir]` composable + copy module.
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

[dir]
path = "./.harness/dir"
```

Resource declarations contain only `path`. Target declarations contain only
`path`. A target path such as `./.claude` automatically uses `.claude` override
folders when they exist inside a resource item. The optional `[dir]` section
turns on dir composition + copy from `./.harness/dir` (or the configured
path); see "Dir Composition And Copy" below. Extensions are declared under
`[extensions.<id>]`; core owns `version` and `activation`, while each extension
owns its remaining fields.

## `.harnessIgnore`

`.harnessIgnore` is the projection boundary. Targets receive all declared
resource roots by default; nested source-local and target-output-local ignore
files decide what does not enter a given subtree. The repo-root file can
match source paths such as `.harness/skills/review/logs/run.log` and target
output paths such as `.agents/skills/review/scratch.tmp`.

```text
# Global source-only state
.harness/**/logs/
.harness/**/*.log
.harness/skills/*/metadata.toml

# Target-specific rules live beside the target output subtree.
# For example, .claude/plugins/.harnessIgnore can contain:
*
```

Use `harness.toml` to declare what exists and where projections may write. Use
`.harnessIgnore` to control which files or whole subtrees are excluded from
projection.

Local `.harnessIgnore` files may also live next to source subtrees or
existing target-output subtrees:

```text
.harness/skills/review/.harnessIgnore     # source-local
resources/AGENTS.md/.harnessIgnore        # custom [dir] source-local
.agents/skills/review/.harnessIgnore      # target-output-local
```

Source-local files match source paths below their directory. Target-output
files match final output paths below their directory and are preserved during
cleanup.

## Profile Overrides

Profiles let a repo keep optional overlays in `.harness` and activate them
with a small selector file:

```text
.harnessProfile                      # contains: deploy
.harness/
  skills/
    review/SKILL.md                  # normal source
    review/aggressiveProfile/
      .harnessProfileRoot            # contains: aggressive
      SKILL.md                       # overlays .harness/skills/review
    deploy/                          # profile root, not a skill
      .harnessProfileRoot            # contains: deploy
      review/SKILL.md                # overlays .harness/skills/review
  profiles/
    personal/
      .harnessProfileRoot            # overlays .harness
      dir/AGENTS.md/100_local.md
```

`.harnessProfile` may live at the repo root or in an existing target/output
subtree such as `.agents/skills/.harnessProfile`; the nearest selector chooses
the active profile for that output path. `.harnessProfileRoot` may live only
under `.harness`, cannot be nested inside another profile root, names the
profile it contributes to, and is never projected as a resource item. Profile
roots nested inside resource or dir source trees overlay their parent folder,
which lets a skill carry its own portable profile override. Profile-local
`.harnessIgnore` files match the logical overlay path, so a profile can
suppress base files or composable parts while adding its own files.

## CLI

```bash
pnpm install
pnpm build
pnpm --filter @harnessconfig/cli exec harnessc validate
pnpm --filter @harnessconfig/cli exec harnessc plan
pnpm --filter @harnessconfig/cli exec harnessc activate
pnpm --filter @harnessconfig/cli exec harnessc activate --yes
pnpm --filter @harnessconfig/cli exec harnessc extension activate --extension dir
pnpm --filter @harnessconfig/cli exec harnessc init --resource prompts --target ./.claude
```

After publishing:

```bash
npx harnessc validate
npx harnessc plan
npx harnessc activate
npx harnessc activate --yes
npx harnessc extension activate --extension dir
npx harnessc init --yes --resource prompts --target ./runtime/agent
```

`harnessc init` writes conventional resource roots (`skills`, `rules`, and
`plugins`) when no `--resource` flags are supplied. Passing one or more
`--resource <kind>` flags writes only those resource roots. Passing
`--target <path>` declares explicit projection targets. Init is a dry run
unless `--yes` is supplied.

`harnessc plan` is read-only and does not infer targets from existing folders.
Folders receive projection only after they are declared in `harness.toml`.

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

`harnessc extension activate` runs registered extensions. The built-in `dir`
extension composes text outputs from mirrored leaf directories:

```text
.harness/dir/
  AGENTS.md/
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .ref
    150_claude.md
```

`CLAUDE.md/.ref` can point to `../AGENTS.md`. Imported and local parts are
sorted together by numeric prefix and concatenated exactly, without generated
headers or separators.

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
    .ref                         # ../AGENTS.md
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

- `./.harness` is the durable repository-owned source root.
- Resource kinds are declarative names, not reserved schema concepts.
- `skills`, `rules`, and `plugins` are conventional init defaults.
- Every projection target is explicit in `harness.toml`.
- Targets are path-only and copy-only in v1.
- Live target folders are derived projection outputs, not source repositories.
- Activation is idempotent for the same source, manifest, ignore rules, cleanup
  policy, and mutable policy.
- `.harnessIgnore` is the single projection filter, with target-specific
  exclusions expressed by target-output-local files.
- `.harnessProfile` selects optional `.harnessProfileRoot` overlays without
  making live target folders source roots.
- Target override folders are derived from target paths.
- `harnessc` is local-first and explains planned changes before writing.

See [the rationale](./docs/RATIONALE.md),
[the standard](./docs/STANDARD.md),
[the adoption guide](./docs/ADOPTION.md),
[tooling](./docs/TOOLING.md),
[conformance](./docs/CONFORMANCE.md), and
[test matrix](./docs/TESTING.md) for details.
