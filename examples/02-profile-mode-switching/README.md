# Profile mode switching

This example shows one basic Harness config idea:

```text
one repo -> different agent modes
```

The selected mode lives in `.harnessProfile`. Change that one file, and
activation swaps which profile-specific skills, prompts, and instruction parts
are generated.

Use this pattern when one repository needs different agent behavior for UI
work, backend changes, and security reviews.

Concepts: [profile overrides](../../docs/STANDARD.md#profile-overrides),
[resources](../../docs/STANDARD.md#resources), and
[dir source](../../docs/STANDARD.md#dir-source).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessProfile                 # selected mode: frontend, backend, security-audit
.harness/
  resources/                    # shared files always active
  dir/                          # shared AGENTS.md and CLAUDE.md source
  profiles/
    frontend/                   # frontend-specific files
    backend/                    # backend-specific files
    security-audit/             # security-specific files

.agents/ .claude/ AGENTS.md CLAUDE.md  # generated output
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate

printf 'security-audit\n' > .harnessProfile
npx harnessc activate
npx harnessc explain .agents/skills/security-audit/SKILL.md --json
npx harnessc activate --yes
```

Expected result:

- `validate` reports no Harness config issues.
- The first apply writes the default `frontend` mode.
- Changing `.harnessProfile` to `security-audit` previews a mode swap.
- The security skill appears after `activate --yes`.
- `explain` shows that the security skill came from the active profile.

## What just happened

Harness kept the shared project context active and added the selected profile
on top. The active profile contributed one mode skill, one mode prompt, and one
`AGENTS.md` section. `CLAUDE.md` imports the shared guide with `.harnessRef`,
so it follows the same selected mode.

Try next: switch to `backend`, dry-run, and inspect the planned creates,
updates, and removals before applying.
