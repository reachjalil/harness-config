# Verification

Run these checks from the repository being set up or migrated.

## Git safety gate

Before migration edits:

```bash
git rev-parse --is-inside-work-tree
git status --short
```

Expected result:

- The repository is inside a Git worktree.
- `git status --short` is empty before any migration edits.
- If either check fails, pause before migration/adoption and offer options to
  initialize Git or preserve the dirty worktree first.

## Validate and preview

```bash
npx harnessc validate
npx harnessc activate
```

Expected result:

- `validate` reports no errors for the selected manifest.
- `activate` is a dry run and writes nothing.
- The plan explains creates, updates, keeps, preserved unmanaged files, mutable
  files, requested removals, and any target symlink conflicts.
- For full migration/adoption, durable root instruction files such as
  `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and equivalents are sourced from
  `.harness/dir` or explicitly documented as blocked/excepted.

## Apply and confirm convergence

```bash
npx harnessc activate --yes
npx harnessc activate
```

Expected result:

- Declared targets receive only the intended files.
- A second dry run converges to `keep` for managed files.
- Runtime-owned files declared in `.harnessMutable` are reported as `mutable` and
  are not overwritten.
- Mutable files that should exist for fresh users have an initial seed under
  `.harness`; `.harnessMutable` is not an ignore rule. Existing non-secret
  target-level settings such as `.claude/settings.json` must be copied to the
  matching seed path, such as `.harness/resources/.claude/settings.json`, before
  they are marked mutable.
- Target symlink conflicts are resolved manually or by explicit
  `[activation].targetSymlinks = "replace"` / `--replace-target-symlinks`
  policy before apply.

## Generated output untracking

When generated target surfaces or generated `[[dir]]` outputs are tracked and
the user does not want generated output tracked after convergence:

```bash
git ls-files .agents .claude .cursor .gemini AGENTS.md CLAUDE.md GEMINI.md
git rm --cached -r .agents .claude .cursor .gemini
git rm --cached AGENTS.md CLAUDE.md GEMINI.md
git add .gitignore .harness AGENTS.md CLAUDE.md GEMINI.md README.md package.json
git diff --cached --name-status
git status --short
```

Use exact generated subtrees when only part of a surface is generated. Include
`.agents`, `.claude`, `.cursor`, `.gemini`, similar target folders, and
generated dir outputs such as `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` as
applicable; do not only untrack `.agents`.

Expected result:

- `git rm --cached -r` stages removal from the index only; generated files still
  exist in the working tree.
- `.gitignore`, `.harness` sources, activation instructions, and untracking are
  staged together with `git add`.
- The staged activation instructions include what to run on a fresh checkout
  and after `git pull` to refresh generated outputs.
- `git diff --cached --name-status` shows the intended source additions/updates
  and index removals for generated outputs, including generated target folders
  and generated root instruction outputs when applicable.
- A dry activation can regenerate the generated surfaces from `.harness`.
- Any file that would be lost is restored or migrated before completion.

## Review checklist

Inspect:

```bash
git diff -- .harness .harnessIgnore AGENTS.md CLAUDE.md .agents .claude .cursor .gemini
```

Confirm:

- durable shared source is under configured resource groups such as
  `.harness/resources`,
- durable root instruction files such as `AGENTS.md`, `CLAUDE.md`,
  `GEMINI.md`, and equivalents are copied into `.harness/dir` as direct
  Markdown files by default, or explicitly documented as blocked/excepted,
- `.harnessComposable`, `.harnessRef`, or split root instructions are used only
  for concrete reasons such as deduplication, profile overlays, local overlays,
  or target-specific tails,
- resource groups have README files when their purpose is not obvious,
- live harness surfaces are outputs, not source folders,
- target-specific differences are encoded as target-derived overrides,
- mutable target-level settings such as `.claude/settings.json` are copied to
  `.harness/resources/.claude/settings.json` or explicitly blocked as
  secret/local state before `.harnessMutable` is used,
- secrets and local machine settings are absent from `.harness`,
- scoped `.harnessIgnore` files protect logs, caches, generated files,
  source-only files, and output-local boundaries,
- gitignored harness surfaces can be regenerated from `.harness` plus the
  selected manifest,
- tracked activation instructions tell users and agents how to run activation
  on a fresh checkout and after `git pull` when generated harness outputs are
  gitignored.
- if generated harness target surfaces or generated dir outputs were already
  tracked by Git, `git rm --cached -r` or `git rm --cached` was actually run for
  every tracked generated output, staged with `git add`, visible as expected
  deletions in `git diff --cached --name-status`, and verified for no
  working-tree data loss.

## Explain Checks

Use `explain` for representative paths:

```bash
npx harnessc explain .harness/resources/skills/foo/SKILL.md --json
npx harnessc explain .agents/skills/foo/SKILL.md --json
```

Confirm ignored resources report the expected winning `.harnessIgnore` rule.
For profile or local-layer changes, confirm the explanation uses the logical
source path the user expects.

## Cleanup Checks

Before using cleanup:

```bash
npx harnessc activate --remove-unmanaged
```

Confirm every `remove` is expected. Target-output `.harnessIgnore` and
`.harnessProfile` files should be preserved. Do not use cleanup to compensate
for an unclear source layout.
