# @harnessconfig/cli

Publishable CLI for the HarnessConfig standard.

```bash
harnessc validate
harnessc plan
harnessc activate
harnessc activate --yes
harnessc transition
harnessc transition --yes
```

The CLI is local-first, read-only by default for validation and planning, and
does not mutate activation surfaces such as `./.agents/skills` or create
standard files unless the relevant command is explicitly applied with `--yes`.

`harnessc transition` is a dry run by default. `harnessc transition --yes`
creates only `./.harness/harness.toml`,
`./.harness/skills`, `./.harness/rules`, `./.harness/plugins`, and a commented
repo-root `./.harnessIgnore`. Live projection is described by `[[targets]]`
in `harness.toml` so consuming tools can decide when to activate a selected
resource set. `./.agents` is the default activation projection. Additional
targets are path-only entries such as `path = "./.claude"` and are materialized
as copy projections.

`harnessc activate` is the reference projection command. Without `--yes`, it
prints a dry run for every target, including creates, updates, requested
removals, projected keeps, and unmanaged entries preserved outside the
projection. With `--yes`, it applies the computed projection.

Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match `.harness`; use `--keep-unmanaged` to make
the default explicit. Repeating the same activation with unchanged inputs and
the same unmanaged cleanup choice should converge to the same plan.
