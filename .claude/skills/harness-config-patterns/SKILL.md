---
name: harness-config-patterns
description: Use when working in the harness-config repository on implementation structure, projection architecture, resource and dir composition, target override precedence, profile and ignore integration, or deciding where code changes belong across packages/core and packages/cli.
---

# HarnessConfig Patterns

## Purpose

Use this skill for implementation design in this repository. It complements
`$harness-config-specs`: the spec says what must happen; this skill describes
how this codebase tends to model it.

## Reference Map

Load the narrowest reference needed:

- `references/code-map.md`: implementation ownership by source file and where
  a behavior usually belongs.
- `references/projection-architecture.md`: activation pipeline, path bases,
  target override precedence, profile/ignore integration, and composables.
- `references/antipatterns.md`: common implementation mistakes to avoid.
## Workflow

1. Decide whether the task changes the standard contract. If yes, use
   `$harness-config-specs` before changing implementation.
2. Read `references/code-map.md` to locate the likely owner.
3. Read `references/projection-architecture.md` for path-base, precedence,
   profile, ignore, or composable behavior.
4. Keep behavior expressed through public core APIs before CLI formatting.
5. Use `$harness-config-testing` for the focused regression shape.
## Guardrails

- Keep path bases explicit. Most subtle bugs come from confusing physical
  source paths, logical source paths, output-relative paths, and target output
  paths.
- Preserve the one-way projection model: runtime folders are outputs.
- Prefer adding focused tests before broad refactors.
## Antipatterns

Read `references/antipatterns.md` for the full list. High-risk mistakes:

- Adding compatibility for per-kind `[resources.<kind>]` declarations in v1.
- Treating `.agents`, `.claude`, or any runtime folder as source input.
- Inferring undeclared targets from folders that happen to exist.
- Updating generated `.agents` or `.claude` dogfood files directly. Edit
  `.harness` and activate.
