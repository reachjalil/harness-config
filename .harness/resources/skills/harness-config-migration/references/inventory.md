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
