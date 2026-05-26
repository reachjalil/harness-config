## Workflow

1. Work from the repository root. Confirm the repo has no unexpected dirty
   files before moving existing agent configuration.
2. Read `references/inventory.md` and inventory current agent-facing files.
3. Read `references/layout.md` and choose explicit targets. Do not infer
   targets from folders that happen to exist.
4. Move shared source into `.harness/resources` or `.harness/dir`; keep
   runtime-specific differences as target overrides.
5. Add `.harnessIgnore` rules for secrets, caches, local settings, generated
   files, and `[mutable]` runtime-owned files.
6. Run the checks in `references/verification.md`.
7. Leave old runtime files in place until a dry activation explains the
   desired projection and the second dry run converges after apply.

Prefer `npx harnessc` in repositories that do not already depend on the local
CLI:

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
```
