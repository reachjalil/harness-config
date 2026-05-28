# Migration

Use this when the repository already has agent-facing files or folders.
Migration should feel helpful and opinionated, but still reversible and
grounded in the user's repo conventions.

## Inventory

Look for:

```bash
rg --files | rg '(^|/)(AGENTS.md|CLAUDE.md|\\.agents|\\.claude|\\.cursor|\\.gemini|skills|plugins|rules|prompts|commands|hooks|agents|settings|mcp|skills-lock\\.json)($|/)'
```

Classify each file as one of:

- durable reusable source;
- target-specific wrapper or packaging;
- repo-relative instruction output;
- runtime-owned local state;
- secret, credential, cache, generated artifact, or trust/permission state.

Also inspect git state before broad moves:

```bash
git status --short
git ls-files AGENTS.md CLAUDE.md .agents .claude .cursor .gemini 2>/dev/null
```

If the repo is under git and the relevant files are tracked, explain that the
transition is easy to review and revert. If important files are untracked,
inspect and summarize them before moving or replacing anything.

## Choose Resource Groups

Move durable projected resources into configured resource roots. For tiny
repos, one root is fine:

```text
.harness/resources/
  README.md
  skills/
  rules/
  plugins/
```

For real migrations, prefer meaningful resource groups over a flat dumping
ground. Let the user choose the vocabulary: workflows, strategies, teams,
modes, kits, agents, products, or domains.

```text
.harness/
  resources-review/
    README.md
    skills/
    rules/
  resources-cloudflare-react/
    README.md
    skills/
    plugins/
    hooks.json
  local/
    resources/
```

Manifest:

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/resources-cloudflare-react"

[[resources]]
path = "./.harness/local/resources"
```

Short README files make resource groups portable and copy/pasteable:

```markdown
# Cloudflare React Resources

Skills, wrappers, and prompts for repositories using React on Cloudflare.
Shared source is tracked here; personal experiments belong in
`.harness/local/resources`.
```

## Root Instructions

Do not automatically split root instruction files. First decide which stance
fits the repo:

- Keep `AGENTS.md`, `CLAUDE.md`, or similar files as normal tracked files when
  they are simple, already working, and do not need generated variants.
- Move clear shared root instruction files into `[[dir]]` when generation makes
  the setup cleaner, such as shared base plus target-specific tails.
- Use `.harnessComposable` and `.harnessRef` when composition removes real
  duplication or enables profiles/local overlays.
- Convert long procedural root instructions into skills, then leave concise
  root pointers.

Example generated root instructions:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_project.md
  200_workflows.md

.harness/dir/CLAUDE.md/
  .harnessComposable
  .harnessRef
  300_claude_tail.md
```

## Preserve Target Differences

Use target-derived overrides for exact target-specific files:

```text
.harness/resources-review/skills/review/SKILL.md
.harness/resources-review/skills/review/.claude/SKILL.md
.harness/resources-review/.agents/hooks.json
.harness/resources-review/.claude/hooks.json
```

Do not duplicate entire resource groups unless the target behavior is genuinely
different.

## Local Layer

Recommend `.harness/local/` as a first-class local workspace:

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/local/resources"
```

Use it for:

- local skills, plugins, agents, prompts, and wrappers;
- experimental skill edits before promotion;
- personal profile roots or selectors;
- local dir instruction parts when `[[dir]]` is in use;
- temporary ignores.

Suggest `.harness/local/` in `.gitignore` when the user wants this layer
private. Promote useful experiments into tracked resource groups after review.

## `.harnessIgnore` Locality

Prefer scoped ignore files close to the thing they control:

```text
.harnessIgnore                                  # broad repo boundaries
.harness/resources-review/.harnessIgnore        # group boundaries
.harness/resources-review/skills/foo/.harnessIgnore
.harness/profiles/security/resources-review/.harnessIgnore
.agents/skills/foo/.harnessIgnore               # local output boundary
```

Use root `.harnessIgnore` for obvious global rules. Use source-local ignores
for resource-specific source-only files. Use profile-local ignores for
switchable modes. Use target-output ignores for local output preferences.

## Generated Surfaces And Cleanup

Live harness surfaces are generated outputs after adoption. A team may commit
them, gitignore them, or mix committed managed files with local target controls.
Recommend gitignoring generated surfaces only when a tracked bootstrap tells
users and agents how to activate them on a fresh checkout.

Good bootstrap examples:

```text
# AGENTS.md

Harness surfaces are generated. Run:

  npx harnessc validate
  npx harnessc activate
```

```json
{
  "scripts": {
    "setup:harness": "npx harnessc validate && npx harnessc activate --yes"
  }
}
```

Use `--remove-unmanaged` only after the dry run clearly shows removals the user
expects. Target-output `.harnessIgnore` and `.harnessProfile` files are local
controls and should be preserved during cleanup.

## Symlinks

Harness config does not follow symlinks while discovering sources or targets.
If a symlinked harness surface points to checked-in agent config and the repo is
under git, replacing it with explicit projection is often a good cleanup.

Workflow:

1. Inspect where the symlink points.
2. Preserve or migrate the real source content into `.harness`.
3. Run `npx harnessc activate` and review the plan.
4. Use `--replace-target-symlinks` or `[activation].targetSymlinks = "replace"`
   only when replacing the link itself is intended.

Stop and ask before changing symlinks that point outside the repo, into a home
directory, secrets, runtime state, or shared machine path.

## Keep Local State Local

Do not move secrets, credentials, caches, runtime permission files, hook trust,
MCP auth, or local machine settings into `.harness`.

Use `[mutable]` for source templates that should be created once and then left
runtime-owned:

```gitignore
[mutable]
**/settings.local.json
**/*.local.json
```

Ignored files stay out of projection. Mutable files can be created once and
then preserved.
