# @harnessconfig/cli

Publishable CLI for the HarnessConfig standard.

```bash
harnessc validate
harnessc plan
harnessc activate
harnessc activate --yes
harnessc init --resource prompts --target ./.claude
harnessc init --yes --resource prompts --target ./.claude
```

The CLI is local-first, read-only by default for validation and planning, and
does not create standard files or mutate projection targets unless the relevant
command is explicitly applied with `--yes`.

`harnessc init` is a dry run by default. With `--yes`, it writes
`./.harness/harness.toml`, declared resource roots, and a commented repo-root
`./.harnessIgnore`. With no `--resource` flags, init uses the
conventional resource roots `skills`, `rules`, and `plugins`. With one or more
`--resource <kind>` flags, init uses only those kinds. Targets are explicit and
path-only; declare them with `--target <path>` or edit `harness.toml`.

`harnessc plan` includes reference-implementation hints for known runtime
surfaces when folders such as `./.agents`, `./.claude`, or `./.cursor` already
exist. These hints help adoption, but they do not make those folders standard
requirements or implicit targets.

`harnessc activate` is the reference projection command. Without `--yes`, it
prints a dry run for every declared target, including creates, updates,
mutable skipped files, requested removals, projected keeps, and unmanaged
entries preserved outside the projection. With `--yes`, it applies the computed
copy projection.

Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match `.harness`; use `--keep-unmanaged` to make
the default explicit. Repeating the same activation with unchanged inputs and
the same unmanaged cleanup choice should converge to the same plan.

Managed files are compared directly with the current projection and reported as
`update` when target bytes differ. Mutable files declared under `[mutable]` in
`.harnessIgnore` are created once and then left untouched unless
`--force-mutable` is supplied.
