---
name: harness-config-patterns
description: Use when working in the harness-config repository on implementation structure, projection architecture, resource and dir composition, target override precedence, profile and ignore integration, or code placement.
---

# Harness config Patterns

## Purpose

Use this skill for implementation design in this repository. The spec defines
the required behavior; this skill helps place the code and avoid projection
mistakes.

## References

- `references/code-map.md`: source files and ownership by behavior.
- `references/projection-architecture.md`: activation pipeline, path bases,
  target overrides, profiles, ignores, and composition.
- `references/antipatterns.md`: common implementation mistakes.

## Workflow

1. Decide whether the task changes the standard contract. If it does, use
   `$harness-config-specs` first.
2. Read the narrowest reference that locates the behavior.
3. Keep behavior in public core APIs before formatting it in the CLI.
4. Use `$harness-config-testing` for the regression shape.

## Guardrails

- Keep physical source paths, logical source paths, output-relative paths, and
  target output paths distinct.
- Preserve the one-way projection model: runtime folders are outputs.
- Do not infer undeclared targets from existing folders.
- Do not edit generated `.agents` or `.claude` files as source.
