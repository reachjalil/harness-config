## Guardrails

- Do not edit generated target folders as source after migration begins.
- Do not move secrets, credentials, runtime caches, or local machine settings
  into `.harness`.
- Do not collapse target-specific behavior into shared files unless it is
  actually portable across targets.
- Do not use per-kind `[resources.<kind>]`; v1 uses one resources root with
  resource kinds as ordinary directories.
- Preserve existing behavior first, then simplify once activation is stable.
