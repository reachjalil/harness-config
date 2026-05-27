# @harnessconfig/cli

[![Website](https://img.shields.io/badge/website-harnessconfig.dev-111827)](https://www.harnessconfig.dev/)
[![Specification](https://img.shields.io/badge/spec-proposal-111827)](https://www.harnessconfig.dev/specifications/v1/)
[![npm harnessc](https://img.shields.io/npm/v/harnessc?label=harnessc)](https://www.npmjs.com/package/harnessc)
[![npm @harnessconfig/cli](https://img.shields.io/npm/v/@harnessconfig/cli?label=%40harnessconfig%2Fcli)](https://www.npmjs.com/package/@harnessconfig/cli)
[![Security](https://img.shields.io/badge/security-policy-111827)](https://github.com/reachjalil/harness-config/security/policy)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

Alpha scoped implementation package for the Harness config CLI. The public CLI
package is `harnessc`.

Most users should run:

```bash
npx harnessc
npx harnessc validate
```

This package exists so the public `harnessc` package can depend on a scoped
implementation package while keeping `npx harnessc` clean.

## Commands

```bash
harnessc validate
harnessc explain .agents/skills/review/SKILL.md
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

## Privacy And Telemetry

Harness config does not collect telemetry.

The `harnessc` CLI does not send analytics, usage events, file paths,
repository names, command history, machine identifiers, or error reports.

Activation, validation, and planning run locally against files in your
repository. The CLI does not make network requests during normal operation.

## Command Behavior

Running `harnessc` with no command validates the nearest repository config and
prints the detected manifest path with suggested next steps. Use
`harnessc validate --json` when a script or editor integration needs the full
inspection object.

`harnessc init` is a dry run by default. With `--yes`, it writes
`./.harness/harness.toml` by default, resource folders under `./.harness/resources` by
default, and a commented repo-root `./.harnessIgnore`. Use `--config <path>`
to write a different repo-local manifest and `--resources-path <path>` to set
an explicit `[[resources]]` entry and create resource folders below that source root. With no
`--resource` flags, init uses the conventional resource folders `skills`,
`rules`, and `plugins`. With one or more `--resource <kind>` flags, init
creates only those folders. Targets are explicit and path-only; declare them
with `--target <path>` or edit the selected manifest.

`harnessc plan` is a read-only initialization/adoption plan. It is not a
projection preview, and it does not infer targets from existing folder names.
Declare targets with `--target <path>` during init or edit the selected
manifest.

`harnessc explain <path>` is read-only introspection for a source or output
path. It reports matching target outputs, configured source roots, source-use
paths, dir actions, and diagnostics. Use `--json` for automation.

`harnessc activate` is the reference projection command. Without `--yes`, it
prints a dry run for every declared target, including creates, updates,
mutable skipped files, requested removals, projected keeps, and unmanaged
entries preserved outside the projection. With `--yes`, it applies the computed
copy projection.

`harnessc extension activate` runs registered extensions. Extensions default to
explicit activation; use `--extension <id>` for one extension or `--all` for
all declared supported extensions. This release ships no built-in extension
implementations. Dir composition and copy are now part of core activation;
declare `[[dir]]` entries in the selected manifest and let `harnessc activate`
handle them.

Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match configured sources; use `--keep-unmanaged`
to make the default explicit. Repeating the same activation with unchanged
inputs and the same unmanaged cleanup choice should converge to the same plan.

Managed files are compared directly with the current projection and reported as
`update` when target bytes differ. Applying an update overwrites the target
with the current source bytes. Mutable files declared under `[mutable]` in
`.harnessIgnore` are created once from source and then left untouched as
runtime-owned target state unless `--force-mutable` is supplied.

`.harnessIgnore` files can be repo-root, source-local, or target-output-local.
Target-output files, such as `.agents/skills/review/.harnessIgnore`, match
final output paths for that subtree and are preserved even when activation is
run with `--remove-unmanaged`.

`.harnessProfile` files select optional profile overlays. A matching
`.harnessProfileRoot` under `.harness`, a configured resources source, or
a configured dir source merges into resources and dir outputs by logical
source path, so local or team-specific kits can add files or replace
composable parts without turning target folders into source roots.

Human terminal output uses ANSI color when the output stream supports it and
keeps `--json` output unstyled for automation. Set `NO_COLOR` to disable color
or `FORCE_COLOR=1` to force it.
