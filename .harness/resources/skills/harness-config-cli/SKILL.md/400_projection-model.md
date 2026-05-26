## Projection Model

- Source of truth: configured source roots, with `.harness` as this repo's
  convention root.
- Manifest: `./.harness/harness.toml` by default, or the repo-local path passed with
  `--config`.
- Resource source: configured by `[resources]`, defaulting to
  `.harness/resources`.
- Dogfood skill source:
  `.harness/resources/skills/harness-config-cli/SKILL.md/`, a resource
  composable leaf that projects to `SKILL.md`.
- Declared targets: `.agents` and `.claude`.
- Root instruction output: `AGENTS.md`, composed from
  `.harness/dir/AGENTS.md`.
- Claude instruction output: `CLAUDE.md`, composed from
  `.harness/dir/CLAUDE.md`, which imports `AGENTS.md` with `.harnessRef` and uses a
  local `.harnessIgnore` to suppress inherited parts that need replacement.

Use top-level `[resources] path = "./path"` only to move the shared resource
source. Do not add `[resources.<kind>]`; resource kinds remain directories.
