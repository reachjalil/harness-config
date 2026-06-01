# Layered local overlays

This example shows one basic Harness config idea:

```text
shared team source -> private local overlay
```

The repo keeps reviewed team source under `.harness/resources` and
`.harness/dir`. A developer can copy the local template into `.harness/local`,
select a personal profile, and test private overrides without committing them.

Use this pattern when a developer wants private agent preferences, experimental
skills, or a temporary mode without changing shared source.

Concepts: [profile overrides](../../docs/STANDARD.md#profile-overrides),
[resources](../../docs/STANDARD.md#resources), and
[reviewability](../../docs/STANDARD.md#reviewability).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessProfile                 # shared by default, personal-lab for local testing
.harness/
  resources/                    # shared team source
  dir/                          # shared AGENTS.md source
  local-template/               # tracked template for the private overlay
  local/                        # private overlay, gitignored

.agents/ AGENTS.md              # generated output
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate

mkdir -p .harness/local
cp -R .harness/local-template/. .harness/local/
printf 'personal-lab\n' > .harness/local/.harnessProfileRoot
printf 'personal-lab\n' > .harnessProfile
npx harnessc activate
npx harnessc explain .agents/skills/repo-review/SKILL.md --json
npx harnessc activate --yes
```

Expected result:

- `validate` reports no Harness config issues.
- The first apply writes the shared team configuration.
- Copying `local-template` into `.harness/local` creates a private overlay.
- Changing `.harnessProfile` to `personal-lab` previews the local override.
- `explain` shows the repo-review skill came from the local overlay.

## What just happened

Harness layered your private local profile over the shared source. The local
profile can replace the same logical files that shared `.harness/resources` and
`.harness/dir` would normally provide. Because `.harness/local/` is ignored,
the experiment stays private until useful files are promoted back into reviewed
source.

Try next: edit `.harness/local/resources/skills/repo-review/SKILL.md`, dry-run,
and compare the planned update without changing shared source.
