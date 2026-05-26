---
title: Patterns
seoTitle: Harness config Patterns And Examples
socialTitle: Practical .harness patterns for teams and developers
description: Concrete examples for target-output ignores, composable instructions, profile overlays, team kits, personal customization, and safe cleanup.
socialDescription: Practical .harness examples for combining ignores, profiles, dir composition, and target cleanup safely.
canonicalPath: /specifications/v1/patterns/
slug: patterns
order: 7
locale: en
sectionCode: "07"
summary: Concrete examples for combining ignores, profiles, dir composition, and cleanup safely.
llmSummary: Shows practical Harness config patterns for target-output ignores, composable instructions, profile overlays, team kits, personal customization, target-local profiles, migration, and cleanup.
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

[resources]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.gemini"

[dir]
path = "./.harness/dir"
```

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

## Composable Instructions

Use `[dir]` for durable repo-root files and target-owned files that are not
resource items. A composable leaf is a directory with an empty
`.harnessComposable` marker. Its numbered parts concatenate into one output
file.

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_intro.md
  200_rules.md
```

Projects:

```text
AGENTS.md
```

The output bytes are `100_intro.md` followed by `200_rules.md`. A `.harnessRef` file
imports another composable leaf before sorting parts:

```text
.harness/dir/CLAUDE.md/
  .harnessComposable
  .harnessRef          # ../AGENTS.md
  300_claude.md
```

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

The `.agents` ignore file can stay in the live surface to control only that
output subtree. The durable skill source moves to `.harness`, and the
`.claude` difference becomes a target-derived override inside the resource.

## Ownership Recommendations

Keep the source and target roles separate:

- Do not point a `[[targets]]` entry at a folder that remains the durable source.
- Move shared authored content into the configured resources source.
- Keep runtime or product state out of `.harness/`; put product caches and activation records in product-owned folders and ignore them.
- Use target-derived overrides for exact file differences. If a target needs a very different skill, prefer a separate resource item over a deep override tree.
- Declare runtime-owned files under `[mutable]` so projection seeds them once and then leaves them alone.
- Replace target and source symlinks with real files or directories before activation.

These recommendations keep activation one-way: configured source roots produce
target outputs, and live runtime folders never become the next source of truth.

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
- `[dir]` outputs that would replace or contain a declared target root should be rejected before apply.
