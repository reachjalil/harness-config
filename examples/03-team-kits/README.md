# Team kits

This example shows one basic Harness config idea:

```text
one shared repo baseline -> optional team-provided kits
```

A kit is a reusable profile bundle. The repo keeps its normal baseline active,
then `.harnessProfile` selects an extra kit such as `deploy-kit`,
`security-kit`, or `onboarding-kit`.

Use this pattern when an organization wants reusable deployment, security, or
onboarding agent configuration layered on top of each repo's baseline.

Concepts: [profile overrides](../../docs/STANDARD.md#profile-overrides),
[resources](../../docs/STANDARD.md#resources), and
[ordered layering](../../docs/STANDARD.md#copy-projection).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessProfile                 # selected kit: deploy-kit, security-kit, onboarding-kit
.harness/
  resources/                    # shared repo baseline
  dir/                          # shared AGENTS.md source
  kits/
    deploy-kit/                 # deploy kit files
    security-kit/               # security kit files
    onboarding-kit/             # onboarding kit files

.agents/ .claude/ AGENTS.md     # generated output
```

## Run it

```bash
npx harnessc validate                                  # check the manifest, kit profile roots, resources, and dir source
npx harnessc activate                                  # dry run: preview the default deploy kit
npx harnessc activate --yes                            # apply: write the deploy-kit generated files
npx harnessc activate                                  # check that nothing new needs to change

printf 'security-kit\n' > .harnessProfile              # switch the selected kit
npx harnessc activate                                  # dry run: preview the kit swap before writing
npx harnessc explain .agents/skills/security-check/SKILL.md --json  # inspect the selected kit source
npx harnessc activate --yes                            # apply: write the security-kit generated files
```

Expected result:

- `validate` reports no Harness config issues.
- The first apply writes the default `deploy-kit`.
- Changing `.harnessProfile` to `security-kit` previews a kit swap.
- The security-check skill appears after `activate --yes`.
- `explain` shows that the security skill came from the selected kit.

## What just happened

Harness kept the repo baseline stable and layered the selected kit on top. The
kit contributed a skill, a prompt, and an `AGENTS.md` section. Kit folders are
profile roots under `.harness`, so they can be reviewed, vendored, or updated
like normal source.

Try next: switch to `onboarding-kit` and inspect how the same base repo gets a
different generated agent posture.
