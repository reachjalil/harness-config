# Quick Start

Use this when the repository has no existing agent folders, or when the user
wants a clean first Harness config setup.

## Minimal Portable Catalog

Start with one resource root, one explicit target, and a small tracked
bootstrap/root instruction file:

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"
```

```text
AGENTS.md
.harnessIgnore
.harness/
  harness.toml
  resources/
    README.md
    skills/
      review/
        SKILL.md
```

`AGENTS.md` can stay as a normal tracked file in the minimal path. It gives a
fresh checkout and future agents enough context before any generated harness
surface exists. Add `.claude`, `.cursor`, `.gemini`, or another target only
when the repository has real content for that harness surface.

## Resource Root README

Add a concise README when the purpose is not obvious:

```markdown
# Shared Harness Resources

Portable skills, rules, and wrappers used by this repository's generated
harness surfaces. Run `npx harnessc validate && npx harnessc activate` to
preview projection before applying.
```

Keep README files short. Their job is to make a folder copy/pasteable and
reviewable, not to duplicate the full standard.

## When To Add `[[dir]]`

Use a `[[dir]]` root when repo-relative generated outputs are useful:

- `AGENTS.md`, `CLAUDE.md`, or similar files should be generated from shared
  parts;
- multiple root instruction files should share a base through `.harnessRef`;
- a profile or local layer should add or replace instruction parts;
- the repo wants activation to regenerate root instruction outputs.

Example:

```toml
[[dir]]
path = "./.harness/dir"
```

```text
.harness/
  dir/
    AGENTS.md/
      .harnessComposable
      100_project.md
      200_workflows.md
    CLAUDE.md/
      .harnessComposable
      .harnessRef
      300_claude_tail.md
```

Do not split root instructions into composable parts unless the split makes
review, reuse, or profile/local customization better. A simple tracked
`AGENTS.md` is often the right first step.

## Optional Local Layer

Offer a local layer when the user wants personal skills, plugins, agents,
prompts, temporary wrappers, or experiments before promoting them back into
tracked source:

```toml
[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"
```

Add local dir roots only when `[[dir]]` is already useful:

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

Later roots win at the same logical output path. Suggest adding
`.harness/local/` to `.gitignore` when the user wants those overrides private;
do not require it.

## Generated Surfaces

Generated harness surfaces such as `.agents`, `.claude`, `.cursor`, and
`.gemini` may be gitignored when they are reproducible from `.harness`.
Recommend that only when a tracked bootstrap exists. Good bootstrap options:

- a short tracked `AGENTS.md`;
- a `README.md` setup section;
- a package script such as `setup:harness`;
- a post-install or onboarding command documented in source.

Example package script:

```json
{
  "scripts": {
    "setup:harness": "npx harnessc validate && npx harnessc activate --yes"
  }
}
```

Always dry run before first apply:

```bash
npx harnessc validate
npx harnessc activate
```

Review the plan. Apply only when the target files match the user's intent:

```bash
npx harnessc activate --yes
npx harnessc activate
```

The second dry run should converge to `keep` for managed files and `mutable`
for runtime-owned files.
