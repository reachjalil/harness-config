# Team kits

Publish a security kit once; any repo turns it on with a single selector.

For when an organization wants reusable deployment, security, or onboarding
agent configuration layered on top of each repo's shared baseline.

Concepts: [profile overrides](../../docs/STANDARD.md#profile-overrides),
[resources](../../docs/STANDARD.md#resources), and
[ordered layering](../../docs/STANDARD.md#copy-projection).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessProfile                 # selector: deploy-kit, security-kit, onboarding-kit
.harness/
  resources/                    # repo baseline
  dir/                          # repo baseline AGENTS.md
  kits/
    deploy-kit/                 # org deploy overlay
    security-kit/               # org security overlay
    onboarding-kit/             # org onboarding overlay
.agents/ .claude/ AGENTS.md     # generated and gitignored
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate

printf 'security-kit\n' > .harnessProfile
npx harnessc activate
npx harnessc explain .agents/skills/security-check/SKILL.md --json
npx harnessc activate --yes
```

The deploy kit is active by default. One selector change swaps in the security
kit and previews the changed generated files before applying.

## What just happened

The repo baseline stayed stable, and the selected kit contributed a skill,
prompt, and `AGENTS.md` section. Kit folders are just profile roots under
`.harness`, so the repo can vendor or update them like any other reviewed
source.

Try next: switch to `onboarding-kit` and inspect how the same base repo gets a
different generated agent posture.
