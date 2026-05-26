## Common Tasks

When asked to explain projection in this repo, describe it concretely:

- Read `references/dogfood-projection.md` first.
- Running without `--yes` is a dry run; running with `--yes` writes outputs.
- Target folders are generated outputs and should not be edited as source.

When editing dogfood setup:

- Edit files under `.harness` first.
- Activate with the local CLI.
- Check the generated root and target files.
- Run focused tests or `pnpm run quality` when behavior or docs change.
