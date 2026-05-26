# @harnessconfig/cli

[![Website](https://img.shields.io/badge/website-harnessconfig.dev-111827)](https://www.harnessconfig.dev/)
[![Specification](https://img.shields.io/badge/spec-v1-111827)](https://www.harnessconfig.dev/specifications/v1/)
[![npm harnessc](https://img.shields.io/npm/v/harnessc?label=harnessc)](https://www.npmjs.com/package/harnessc)
[![npm @harnessconfig/cli](https://img.shields.io/npm/v/@harnessconfig/cli?label=%40harnessconfig%2Fcli)](https://www.npmjs.com/package/@harnessconfig/cli)
[![Security](https://img.shields.io/badge/security-policy-111827)](https://github.com/reachjalil/harness-config/security/policy)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

Scoped implementation package for the Harness config CLI. The public CLI
package is `harnessc`.

Most users should run:

```bash
npx harnessc validate
```

This package exists so the public `harnessc` package can depend on a scoped
implementation package while keeping `npx harnessc` clean.

## Commands

```bash
harnessc validate
harnessc init
harnessc activate
harnessc activate --yes
harnessc extension activate --all --yes
harnessc init --resource prompts --target ./runtime/agent
harnessc init --yes --resource prompts --target ./runtime/agent
harnessc plan
```

Website: https://www.harnessconfig.dev/

Specification: https://www.harnessconfig.dev/specifications/v1/

The CLI is local-first, read-only by default for validation and planning, and
does not create standard files or mutate projection targets unless the relevant
command is explicitly applied with `--yes`.

`harnessc init` is a dry run by default. With `--yes`, it writes
`./.harness/harness.toml` by default, resource folders under `./.harness/resources` by
default, and a commented repo-root `./.harnessIgnore`. Use `--config <path>`
to write a different repo-local manifest and `--resources-path <path>` to set
`[resources] path` and create resource folders below that source. With no
`--resource` flags, init uses the conventional resource folders `skills`,
`rules`, and `plugins`. With one or more `--resource <kind>` flags, init
creates only those folders. Targets are explicit and path-only; declare them
with `--target <path>` or edit the selected manifest.

`harnessc plan` is a read-only initialization/adoption plan. It is not a
projection preview, and it does not infer targets from existing folder names.
Declare targets with `--target <path>` during init or edit the selected
manifest.

`harnessc activate` is the reference projection command. Without `--yes`, it
prints a dry run for every declared target, including creates, updates,
mutable skipped files, requested removals, projected keeps, and unmanaged
entries preserved outside the projection. With `--yes`, it applies the computed
copy projection.

`harnessc extension activate` runs registered extensions. Extensions default to
explicit activation; use `--extension <id>` for one extension or `--all` for
all declared supported extensions. This release ships no built-in extension
implementations. Dir composition and copy are now part of core activation;
declare `[dir]` in the selected manifest and let `harnessc activate` handle it.

Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match configured sources; use `--keep-unmanaged`
to make the default explicit. Repeating the same activation with unchanged
inputs and the same unmanaged cleanup choice should converge to the same plan.

Managed files are compared directly with the current projection and reported as
`update` when target bytes differ. Applying an update overwrites the target
with the current source bytes. Mutable files declared under `[mutable]` in
`.harnessIgnore` are created once and then left untouched unless
`--force-mutable` is supplied.

`.harnessIgnore` files can be repo-root, source-local, or target-output-local.
Target-output files, such as `.agents/skills/review/.harnessIgnore`, match
final output paths for that subtree and are preserved even when activation is
run with `--remove-unmanaged`.

`.harnessProfile` files select optional profile overlays. A matching
`.harnessProfileRoot` under `.harness`, the configured resources source, or
the configured dir source merges into resources and `[dir]` outputs by logical
source path, so local or team-specific kits can add files or replace
composable parts without turning target folders into source roots.

Human terminal output uses ANSI color when the output stream supports it and
keeps `--json` output unstyled for automation. Set `NO_COLOR` to disable color
or `FORCE_COLOR=1` to force it.
