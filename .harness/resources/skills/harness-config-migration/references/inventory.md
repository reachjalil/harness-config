# Inventory Reference

Read this before changing files in a repository being migrated.

## Scan

Use fast file discovery first:

```bash
rg --files -g 'AGENTS.md' -g 'CLAUDE.md' -g '.agents/**' -g '.claude/**' -g '.cursor/**' -g '.gemini/**' -g '.codex/**'
rg --files | rg '(^|/)(agents|skills|plugins|rules|commands|prompts|hooks|mcp|settings|config)($|/)'
```

Also inspect repository docs for agent setup instructions:

```bash
rg -n "AGENTS|CLAUDE|Codex|Claude|Cursor|Gemini|skill|plugin|prompt|rule|MCP|hook|agent" README.md docs .github . 2>/dev/null
```

## Classify

Classify each found file before moving it:

- Shared instructions: portable guidance useful to multiple runtimes.
- Runtime-specific instructions: files that should become target overrides.
- Skills/plugins/rules: reusable resources that belong under
  `.harness/resources`.
- Root instruction files: repo-level files that belong under `.harness/dir`.
- Runtime-owned state: local settings, caches, credentials, logs, generated
  indexes, and machine-specific config.
- Unknown files: leave in place until their runtime contract is understood.

## Evidence

Keep a short migration note in the final response:

- discovered source files,
- chosen targets,
- files moved to `.harness`,
- files intentionally left runtime-owned,
- commands run and convergence result.

Also state whether the result is a complete migration or blocked. A migration
is complete only when every durable discovered resource is migrated or
explicitly documented as intentionally unmanaged. Otherwise, say the migration
is blocked/incomplete and name the remaining live resources.

Use this adoption checklist before claiming completion:

| Check | Required evidence |
| --- | --- |
| Inventory | All live harness surfaces, root instructions, settings, and resource folders were scanned. |
| Durable resources | Every reusable resource was migrated into `.harness` or blocked with a reason. |
| Plan options | The user saw a recommended plan and meaningful layout options when the repo had enough durable resources to justify them. |
| Agent guidance | Root agent instructions tell future agents to use Harness config guidance and edit `.harness` sources for agent-config operations. |
| Mutable seeds | Every create-once runtime file that fresh users should receive is copied into `.harness` as a seed before `.harnessMutable`. |
| Target ignores | Generated surfaces such as `.agents` or `.claude` have target-output `.harnessIgnore` files when they need local-only output boundaries. |
| Generated outputs | Live surfaces are treated as generated and can be gitignored after convergence. |
| Cleanup | `--remove-unmanaged` is used only after reviewed removals are migrated, archived, or explicitly approved for deletion. |
| Verification | Validate, dry run, apply, and convergence dry run succeeded. |

The migration plan shown before edits must include the skill guide version,
explicit target list, resource roots, direct-copy/composable root-file decision,
root instruction maintenance note, mutable seed paths copied into `.harness`,
target-output `.harnessIgnore` recommendations, gitignore recommendation for
generated surfaces, cleanup policy for unmanaged removals, and any blockers. If
`.claude` exists and has durable content or settings, include it as a target
unless the user chooses otherwise.

Use tables for the user-facing summary:

```markdown
| Surface | Durable resources | Runtime/local state | Decision |
| --- | ---: | ---: | --- |
| `.agents` | 5 skills | 2 settings files | migrate skills, ignore local state |
| `.claude` | 5 matching skills | 1 cache | migrate overrides, ignore cache |
```

Then report verification:

```markdown
| Command | Result |
| --- | --- |
| `npx harnessc validate` | passed |
| `npx harnessc activate --yes` | applied |
| second `npx harnessc activate` | converged |
```
