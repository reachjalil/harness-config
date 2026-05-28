---
title: Patterns
seoTitle: Harness config Patterns And Examples
socialTitle: Practical .harness patterns for teams and developers
description: Concrete examples for runtime-owned mutable files, target-output ignores, composable instructions, profile overlays, team kits, personal customization, and safe cleanup.
socialDescription: Practical .harness examples for combining mutable runtime state, ignores, profiles, dir composition, and target cleanup safely.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: en
sectionCode: "07"
summary: Concrete examples for combining runtime-owned mutable files, ignores, profiles, dir composition, and cleanup safely.
llmSummary: Shows practical Harness config patterns for runtime-owned mutable files, target-output ignores, composable instructions, profile overlays, team kits, personal customization, target-local profiles, migration, and cleanup.
audience: Developers and platform teams adopting Harness config in real repositories.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Harness config Patterns

This page shows how to combine the standard pieces without losing the main
ownership rule: `.harness/` is canonical source, and live target folders are
generated outputs with a few protected local controls.

Start with an explicit manifest at `./.harness/harness.toml`:

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.gemini"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  harness.toml
  resources/
    README.md
    skills/
    rules/
  dir/
    AGENTS.md/
      .harnessComposable
  local/
    resources/
    dir/
.agents/
.claude/
.gemini/
```

The manifest names the source roots and targets. The filesystem shows where
reviewed source lives and which live harness surfaces activation can generate.

## Resource Groups

For non-trivial repositories, use multiple resources sources when it makes the
catalog easier to understand and reuse. Name groups by usefulness: workflow,
strategy, team, mode, product area, agent set, or kit.

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/resources-frontend"

[[resources]]
path = "./.harness/local/resources"
```

```text
.harness/
  resources-review/
    README.md
    skills/
    rules/
  resources-frontend/
    README.md
    skills/
    plugins/
  local/
    resources/
```

Short README files make each group easier to copy into another project. The
local layer is useful for personal skills, plugins, agents, prompts, and
experiments before promotion into tracked source.

## Target-Output Ignore For One Live Surface

Use a target-output `.harnessIgnore` when the rule belongs to one live output
subtree, not to the canonical source.

```text
.agents/skills/deploy-plan/.harnessIgnore
*.tmp
```

This excludes final output paths under `.agents/skills/deploy-plan/`:

```text
.agents/skills/deploy-plan/scratch.tmp
.agents/skills/deploy-plan/logs/run.tmp
```

It does not affect:

```text
.claude/skills/deploy-plan/scratch.tmp
```

Target-output ignores match output paths, not source paths. They also
participate only after the `.harnessIgnore` file exists on disk. Put rules in
the repo-root `.harnessIgnore` or a source-local `.harnessIgnore` when the rule
must apply on first activation.

This pattern is intentionally target-local. It is most useful for gitignored
live harness surfaces, local development experiments, or machine-specific
runtime files that should not become shared source. The file is preserved and
read from the target output, but it is not copied there by projection.

## Logical Ignore Re-Includes

Use shallow rules for broad boundaries and deeper logical rules for selected
exceptions. Profile-local ignore files are evaluated at the profile root's
logical overlay location, not at the physical profile folder.

```toml
[[resources]]
path = "./.harness/resources-tooling"

[[targets]]
path = "./.agents"
```

```text
.harnessIgnore
.harnessProfile                  # contains: cloudflare-react
.harness/
  resources-tooling/
    skills/
      vite-worker-imports-config-skill/SKILL.md
      codex-agent-management/SKILL.md
    cloudflare-react/
      .harnessProfileRoot         # contains: cloudflare-react
      .harnessIgnore
```

```gitignore
# .harnessIgnore
.harness/resources-tooling/skills/**
```

```gitignore
# .harness/resources-tooling/cloudflare-react/.harnessIgnore
!skills/
!skills/vite-worker-imports-config-skill/
!skills/vite-worker-imports-config-skill/**
```

With `cloudflare-react` active, only `vite-worker-imports-config-skill`
crosses the projection boundary. `codex-agent-management` stays ignored
because the profile-local file participates at `.harness/resources-tooling/`
and its descendant re-include names only the Vite worker skill.

## Runtime-Owned Mutable Files

Use `[mutable]` when the repository should seed a file once and the runtime
should own it afterward.

```text
.harnessIgnore
[mutable]
.harness/resources/**/settings.local.json
```

```text
.harness/resources/skills/review/settings.local.json
.agents/skills/review/settings.local.json
.claude/skills/review/settings.local.json
```

On first activation, the source template creates the target file. After that,
activation reports the target as `mutable` and leaves its bytes alone, even if
the runtime has changed them. This is the right shape for permission grants,
local settings, learned commands, and other state that must be visible in the
plan without becoming canonical source.

Use ignore rules for files that should never cross the projection boundary.
Use `[mutable]` for files that should cross once as a template and then belong
to the live harness surface.

## Composable Instructions

Use `[[dir]]` sources for durable repo-root files and target-owned files that are not
resource items. A composable leaf is a directory with an empty
`.harnessComposable` marker. Its numbered parts concatenate into one output
file. When the same marker is used under a configured resources source, it
composes a projected resource file inside each target instead of a repo-root or
target-owned dir output.

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

```text
.harness/
  dir/
    AGENTS.md/
      .harnessComposable
      100_intro.md
      200_rules.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef          # ../AGENTS.md
      300_claude.md
  local/
    dir/
      AGENTS.md/
        900_local.md
```

Projects:

```text
AGENTS.md
CLAUDE.md
```

`AGENTS.md` is composed from shared parts plus any later local parts.
`CLAUDE.md` imports the `AGENTS.md` leaf first, then adds the Claude-specific
tail. Use this pattern when generation removes real duplication or enables
profiles/local overlays; keep simple root files as normal tracked files when
composition does not help.

Source-local `.harnessIgnore` files can remove individual parts:

```text
.harness/dir/AGENTS.md/.harnessIgnore
200_rules.md
```

Target-output `.harnessIgnore` files can suppress a full output after the final
output path is known:

```text
notes/.harnessIgnore
release.md
```

## Repo-Wide Profile

A repo-root `.harnessProfile` selects one profile for the whole projection.
When a `.harnessProfileRoot` sits directly under the configured resources
source, its children overlay that resources source.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contains: deploy

.harness/
  resources/
    skills/
      review/
        SKILL.md
    deploy/
      .harnessProfileRoot  # contains: deploy
      skills/
        deploy-plan/
          SKILL.md
```

When profile `deploy` is active, `deploy-plan` is projected as a skill. The
`deploy` folder itself is not projected as a resource because it is overlay
storage.

Use this shape when the overlay belongs to one resource kind.

## Team-Provided Profile Kit

A kit profile can overlay `.harness` itself and contribute several logical
source roots at once.

```toml
[[resources]]
path = "./.harness/resources"

[[dir]]
path = "./.harness/dir"

[[targets]]
path = "./.agents"
```

```text
.harnessProfile          # contains: deploy-kit

.harness/
  kits/
    deploy-kit/
      .harnessProfileRoot # contains: deploy-kit
      resources/
        skills/
          deploy-plan/
            SKILL.md
      dir/
        AGENTS.md/
          .harnessComposable
          100_deploy.md
```

This kit overlays into `.harness/resources/skills` and `.harness/dir`. It can add a
skill and add a deploy-specific instruction part without becoming a projected
`.agents/kits/deploy-kit/` folder.

This is the right model for company-provided deploy, security, frontend,
backend, or onboarding kits. The kit is reviewed source. The selector decides
where it is active.

## Generated Surfaces With Bootstrap

Generated harness surfaces can be gitignored when the repository keeps a
tracked bootstrap path. The manifest and source catalog stay in version
control; the live folders can be regenerated after checkout.

```toml
[[resources]]
path = "./.harness/resources-agent-tools"

[[resources]]
path = "./.harness/resources-review"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

```text
AGENTS.md                         # bootstrap note for humans and agents
package.json                      # optional setup:harness script
.gitignore
.harness/
  harness.toml
  resources-agent-tools/
    README.md
    skills/
      harness-config/
        SKILL.md
  resources-review/
    README.md
    skills/
.agents/                          # generated, gitignored
.claude/                          # generated, gitignored
```

```gitignore
.agents/
.claude/
```

The bootstrap should tell users and agents to run `npx harnessc validate` and
dry-run activation before applying. Do not gitignore generated surfaces when a
fresh checkout would leave users with empty harness folders and no clear
activation path.

## Personal AGENTS.md Override

Profiles can add personal instruction parts and remove base parts by logical
source path.

```text
.harnessProfile          # contains: my-profile

.harness/
  profiles/
    my-profile/
      .harnessProfileRoot # contains: my-profile
      dir/
        AGENTS.md/
          .harnessIgnore  # contains: 100_intro.md
          100_my_intro.md
```

If base `AGENTS.md` has `100_intro.md` and `300_rules.md`, the active profile
can replace the intro while keeping the shared rules. The profile-local
`.harnessIgnore` is evaluated against the logical path
`.harness/dir/AGENTS.md/100_intro.md`, not the physical storage path under
`.harness/profiles/my-profile`.

Track `.harnessProfile` when the team should share the same choice. Gitignore
it when each developer should choose their own profile locally.

## Target-Local Profiles

Target-output `.harnessProfile` files let different live subtrees select
different profile overlays.

```text
.agents/
  skills/
    .harnessProfile      # contains: deploy
  rules/
    .harnessProfile      # contains: no-rules
```

The `deploy` profile applies under `.agents/skills/`. The `no-rules` profile
applies under `.agents/rules/`. Neither selector changes `.claude/`, repo-root
outputs, or sibling `.agents` subtrees.

Target-output `.harnessProfile` files are preserved during cleanup for the
same reason target-output `.harnessIgnore` files are preserved: they are live
subtree controls, not projected payload.

## Migrating Manual Agent Folders

For an existing repository, move durable shared content into `.harness` first
and keep local live controls where they already make sense.

```text
# before
.claude/skills/review/SKILL.md
.agents/skills/review/SKILL.md
.agents/skills/review/.harnessIgnore

# after
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md
.agents/skills/review/.harnessIgnore
```

The `.agents` ignore file can stay in the live harness surface to control only that
output subtree. The durable skill source moves to `.harness`, and the
`.claude` difference becomes a target-derived override inside the resource.

## Ownership Recommendations

Keep the source and target roles separate:

- Do not point a `[[targets]]` entry at a folder that remains the durable source.
- Move shared authored content into configured resources sources.
- Gitignore live harness surfaces when local experimentation or runtime state
  matters more than committing generated output.
- Keep runtime or product state out of `.harness/`; put product caches and activation records in product-owned folders and ignore them.
- Use target-derived overrides for exact file differences. If a target needs a very different skill, prefer a separate resource item over a deep override tree.
- Declare runtime-owned files under `[mutable]` so projection seeds them once and then leaves them alone.
- Do not rely on source or target symlinks being followed. Treat them as leaf entries and review any replace or remove action before activation.

These recommendations keep activation one-way: configured source roots produce
target outputs, and live harness surfaces never become the next source of truth.

## Cleanup Checklist

Before running cleanup with `--remove-unmanaged`, check the plan:

- Managed files should be `keep`, `create`, or `update`.
- Runtime-owned files declared under `[mutable]` should be `mutable` after the
  first activation.
- Unmanaged files should be removed only when the plan explicitly shows
  `remove`.
- Target-output `.harnessIgnore` and `.harnessProfile` files should stay
  preserved.
- Cleanup only applies to targets that are still declared. Clean a target before
  removing its `[[targets]]` entry, or use a higher-level activation-state
  workflow that can reconcile orphaned targets.

Cleanup is useful after migration, but it is intentionally explicit. If a file
is still valuable, move it into `.harness`, declare it mutable, or keep it as a
target-output control before applying removal.

## Safety Checks

Use these checks before trusting a repository or tool implementation:

- `validate` should be read-only and should reject paths outside the repository.
- A first dry run should explain every `create`, `update`, `remove`, `keep`, `mutable`, and preserved unmanaged entry before writing.
- A second activation against unchanged inputs should converge to `keep` for managed files and `mutable` for runtime-owned files.
- Cleanup should preserve unmanaged entries by default and delete them only when removal is explicit.
- Target-output `.harnessIgnore` and `.harnessProfile` files should be preserved even during unmanaged cleanup.
- Mutable files should never be overwritten unless the user explicitly chooses a force re-projection.
- Dir outputs that would replace or contain a declared target root should be rejected before apply.
