# Dogfood Projection Reference

Read this when explaining or changing how this repository projects its own
agent instructions and skills.

## Ownership

- Source of truth: configured source roots, with `.harness` as this repo's
  convention root.
- Manifest: `./.harness/harness.toml` by default, or the repo-local path passed
  with `--config`.
- Resource source: configured by `[resources]`, defaulting to
  `.harness/resources`.
- Declared targets: `.agents` and `.claude`.
- Generated outputs: `.agents`, `.claude`, root `AGENTS.md`, and root
  `CLAUDE.md`.

Use top-level `[resources] path = "./path"` only to move the shared resource
source. Do not add `[resources.<kind>]`; resource kinds remain directories.

## Skill Projection

- Dogfood skill source:
  `.harness/resources/skills/harness-config-cli/SKILL.md/`.
- That directory is a resource composable leaf. It projects to
  `skills/harness-config-cli/SKILL.md` in every declared target.
- Resource composable leaves use `.harnessComposable` and numbered parts under
  a directory whose name is the projected file path, such as
  `SKILL.md/100_frontmatter.md`.
- The `.claude` resource override imports the shared composable with
  `.harnessRef` and appends a Claude-only verification section.

## Root Instruction Projection

- `[dir]` composes `.harness/dir/AGENTS.md` into root `AGENTS.md`.
- `[dir]` composes `.harness/dir/CLAUDE.md` into root `CLAUDE.md`.
- `CLAUDE.md/.harnessRef` imports `../AGENTS.md`.
- `CLAUDE.md/.harnessIgnore` can hide an imported part with a recipient-local
  path such as `AGENTS.md/150_identity.md`, then `CLAUDE.md/150_identity.md`
  supplies the Claude-specific replacement.
