# Dogfood Projection Reference

Read this when explaining or changing how this repository projects its own
agent instructions and skills.

## Ownership

- Source of truth: configured source roots, with `.harness` as this repo's
  convention root.
- Manifest: `./.harness/harness.toml` by default, or the repo-local path passed
  with `--config`.
- Resource sources: declared with ordered `[[resources]]` entries. This repo
  uses `.harness/resources`.
- Declared targets: `.agents` and `.claude`.
- Generated outputs: `.agents`, `.claude`, root `AGENTS.md`, and root
  `CLAUDE.md`.

Use top-level `[[resources]] path = "./path"` entries to declare shared
resource sources. Do not add `[resources.<kind>]`; resource kinds remain
directories.

## Skill Projection

- Dogfood skills use plain files such as
  `.harness/resources/skills/harness-config-cli/SKILL.md`.
- Plain skill files project to the same relative path in every declared target.
- Keep dogfood skills useful and direct. Use dedicated tests, not this repo's
  day-to-day skill sources, to exercise resource composables, `.harnessRef`,
  and target-specific skill overrides.

## Root Instruction Projection

- `[[dir]]` composes `.harness/dir/AGENTS.md` into root `AGENTS.md`.
- `[[dir]]` composes `.harness/dir/CLAUDE.md` into root `CLAUDE.md`.
- `CLAUDE.md/.harnessRef` imports `../AGENTS.md`.
- `CLAUDE.md/.harnessIgnore` can hide an imported part with a recipient-local
  path such as `AGENTS.md/150_identity.md`, then `CLAUDE.md/150_identity.md`
  supplies the Claude-specific replacement.
