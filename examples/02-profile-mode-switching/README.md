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
npx harnessc validate                                  # check the manifest, profile roots, resources, and dir source
npx harnessc activate                                  # dry run: preview the default frontend mode
npx harnessc activate --yes                            # apply: write the frontend generated files
npx harnessc activate                                  # check that nothing new needs to change

printf 'security-audit\n' > .harnessProfile            # switch the selected profile
npx harnessc activate                                  # dry run: preview the mode swap before writing
npx harnessc explain .agents/skills/security-audit/SKILL.md --json  # inspect the active profile source
npx harnessc activate --yes --remove-orphans           # apply: write security-audit and remove stale frontend outputs
```

Expected result:

- `validate` reports no Harness config issues.
- The first apply writes the default `frontend` mode.
- Changing `.harnessProfile` to `security-audit` previews a mode swap.
- The security skill appears after `activate --yes --remove-orphans`.
- Unedited frontend-only outputs are removed because the old profile can still
  produce them and they are now orphaned managed outputs.
- `explain` shows that the security skill came from the active profile.

## What just happened

Harness kept the shared project context active and added the selected profile
on top. The active profile contributed one mode skill, one mode prompt, and one
`AGENTS.md` section. `CLAUDE.md` imports the shared guide with `.harnessRef`,
so it follows the same selected mode.

Try next: switch to `backend`, dry-run, and inspect the planned creates,
updates, orphaned outputs, and removals before applying with
`--remove-orphans`. Use `--remove-unmanaged` only for target files that no
configured source can produce anymore, such as outputs from deleted or newly
ignored source files.
