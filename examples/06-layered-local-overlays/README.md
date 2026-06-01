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
npx harnessc validate                                  # check the manifest, shared source, and local overlay paths
npx harnessc activate                                  # dry run: preview the shared team configuration
npx harnessc activate --yes                            # apply: write the shared generated files
npx harnessc activate                                  # check that nothing new needs to change

mkdir -p .harness/local                                # create the private overlay folder
cp -R .harness/local-template/. .harness/local/        # copy the tracked template into the private overlay
printf 'personal-lab\n' > .harness/local/.harnessProfileRoot  # mark the local folder as a profile root
printf 'personal-lab\n' > .harnessProfile              # switch to the local profile
npx harnessc activate                                  # dry run: preview the local override before writing
npx harnessc explain .agents/skills/repo-review/SKILL.md --json  # inspect why the local skill wins
npx harnessc activate --yes                            # apply: write the local overlay output
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
