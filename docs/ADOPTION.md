# HarnessConfig Adoption

HarnessConfig v1 starts from a greenfield source contract:

1. Create `.harness/harness.toml`.
2. Add resource roots such as `.harness/skills`, `.harness/rules`, or custom
   `.harness/<kind>` folders.
3. Declare every projection target explicitly in `harness.toml`.
4. Use `.harnessIgnore` to keep source-only files out of live targets and mark
   runtime-owned files with `[mutable]`.
5. Dry-run activation before writing target folders.

`harnessc` is the standard implementation for this workflow:

```bash
harnessc init
harnessc init --yes --resource skills --target ./.agents
harnessc validate
harnessc activate
harnessc activate --yes
```

The standard itself stays limited to the source layout, target declarations,
overrides, projection ignores, mutable files, and deterministic copy
projection. Product-specific selection, marketplace, target edit review,
activation records, capture, and remote sync belong above the base standard.
