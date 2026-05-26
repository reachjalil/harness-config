## Common Tasks

When asked to explain projection in this repo, describe it concretely:

- `activate` composes
  `.harness/resources/skills/harness-config-cli/SKILL.md/` into `SKILL.md`
  and copies it to both `.agents/skills/harness-config-cli/SKILL.md` and
  `.claude/skills/harness-config-cli/SKILL.md`.
- Resource composable leaves use `.harnessComposable` and numbered parts
  under a directory whose name is the projected file path, such as
  `SKILL.md/100_frontmatter.md`.
- `[dir]` composes `.harness/dir/AGENTS.md` into root `AGENTS.md`.
- `[dir]` composes `.harness/dir/CLAUDE.md` into root `CLAUDE.md`.
  `CLAUDE.md/.harnessRef` imports `../AGENTS.md`; `CLAUDE.md/.harnessIgnore` can
  hide an imported part with a recipient-local path such as
  `AGENTS.md/150_identity.md`, then `CLAUDE.md/150_identity.md` supplies the
  Claude-specific replacement.
- Running without `--yes` is a dry run; running with `--yes` writes outputs.
- Target folders are generated outputs and should not be edited as source.

When editing dogfood setup:

- Edit files under `.harness` first.
- Activate with the local CLI.
- Check the generated root and target files.
- Run focused tests or `pnpm run quality` when behavior or docs change.
