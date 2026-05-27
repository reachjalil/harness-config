# CLI

Use this reference when the user asks how to run Harness config locally, preview
activation, apply changes, validate a repository, or troubleshoot command
output.

## Command order

Run from the repository root:

```bash
npx harnessc validate
npx harnessc activate
```

`validate` checks the selected manifest and source layout. `activate` without
`--yes` is a dry run and should not write files.

After reviewing the plan, apply:

```bash
npx harnessc activate --yes
```

Then confirm convergence:

```bash
npx harnessc activate
```

A healthy second dry run reports managed files as stable and mutable runtime
files as preserved.

## Common options

- `--root <path>`: run against another repository root.
- `--config <path>`: use a non-default manifest path.
- `--yes`: apply the activation plan.
- `--force-mutable`: rewrite files protected by `[mutable]` rules.
- `--keep-unmanaged`: preserve unmanaged target files.
- `--remove-unmanaged`: remove unmanaged target files when the plan says so.

Use removal flags only after the user has inspected the dry-run plan.

## Reading plans

Treat the dry-run plan as the user review surface:

- `create`: a managed file will be written.
- `update`: a managed file will change.
- `keep`: a managed file already matches the source.
- `mutable`: a runtime-owned file is intentionally preserved.
- `preserve`: an unmanaged file is left alone.
- `remove`: an unmanaged file is removed only when explicitly requested.

If the plan includes unexpected creates or updates, stop and inspect the source
layout, manifest targets, `.harnessIgnore`, and target-derived overrides before
applying.

## Troubleshooting

- Missing target output usually means the target is not declared in
  `.harness/harness.toml`.
- Unexpected target output usually means a source file is under
  `.harness/resources` or `.harness/dir` without the intended
  `.harnessIgnore` boundary.
- Unexpected overwrites usually mean a runtime-owned file is not listed under
  `[mutable]`.
- Divergent `.agents` and `.claude` output should usually be represented with
  target-derived overrides, not copied source trees.

When command behavior is unclear, use `harnessconfig.dev` as the public
reference and prefer dry-run activation before writing files.
