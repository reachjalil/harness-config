# Profile mode switching

Switch your agent from frontend to security-audit mode with one line, then
preview the diff before writing generated files.

For when one repo needs different agent behavior for UI work, backend changes,
and security reviews.

Concepts: [profile overrides](../../docs/STANDARD.md#profile-overrides),
[resources](../../docs/STANDARD.md#resources), and
[dir source](../../docs/STANDARD.md#dir-source).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessProfile                 # selector: frontend, backend, security-audit
.harness/
  resources/                    # shared resources always active
  dir/                          # shared AGENTS.md and CLAUDE.md parts
  profiles/
    frontend/                   # frontend overlay
    backend/                    # backend overlay
    security-audit/             # security overlay
.agents/ .claude/ AGENTS.md CLAUDE.md  # generated and gitignored
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

The first apply writes frontend mode. Changing `.harnessProfile` to
`security-audit` makes the next dry run show the mode swap before applying it.

## What just happened

The base project context stayed active, while the selected profile overlaid a
mode skill, a mode prompt, and an `AGENTS.md` section. `CLAUDE.md` imports the
shared guide through `.harnessRef`, so it follows the same selected mode.

Try next: switch to `backend`, dry-run, and inspect the planned creates,
updates, and removals before applying.
