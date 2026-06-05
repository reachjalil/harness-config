# Isolated profile packs

This example shows one Harness config idea:

```text
general source + wildcard packs -> one selected isolated pack view
```

The selected pack lives in `.harnessProfile`. Each pack is a profile root under
`.harness/packs/<name>`, and its `.harnessProfileIsolation` file says which
logical paths should be exclusive to the selected profile.

Use this pattern when a tool or team wants portable packs that can be enabled
or disabled by profile selection without rewriting the manifest or root
`.harnessIgnore`.

Concepts: [profile overrides](../../docs/STANDARD.md#profile-overrides),
[wildcard source paths](../../docs/STANDARD.md#path-patterns), and
[resources](../../docs/STANDARD.md#resources).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
.harnessProfile                      # selected pack: frontend
.harness/
  resources/                         # general shared source
  dir/                               # general dir source
  packs/*/resources                  # portable pack resources
  packs/*/dir                        # portable pack dir outputs
  local-packs/*/resources            # optional same-name local overrides
  local-packs/*/dir                  # optional same-name local dir overrides

.agents/ AGENTS.md PROJECT_GUIDE.md  # generated output
```

The frontend pack declares:

```toml
version = 1

[isolate]
resources = ["skills/**"]
dir = ["AGENTS.md", "AGENTS.md/**"]
```

That means the selected frontend pack owns skill resources and `AGENTS.md`
composition. Unrelated resources and dir outputs continue to project normally.

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc explain .agents/skills/frontend/SKILL.md --json
npx harnessc explain .agents/prompts/shared.md --json
```

Expected result:

- `validate` reports no Harness config issues.
- `.agents/skills/frontend/SKILL.md` comes from the selected frontend pack.
- `.agents/skills/local-frontend/SKILL.md` comes from the same-name local pack.
- `.agents/skills/baseline/SKILL.md` does not project while frontend is active.
- `.agents/skills/backend/SKILL.md` does not project because backend is not
  selected.
- `.agents/prompts/shared.md` still projects from the general resources source.
- `AGENTS.md` contains frontend and local pack parts, not the base part.
- `PROJECT_GUIDE.md` still projects because only `AGENTS.md` is isolated.

## What just happened

Harness expanded the wildcard pack roots, found every existing pack source,
then applied only the profile roots named by `.harnessProfile`. The frontend
pack isolated `skills/**` and `AGENTS.md`, so matching base/general candidates
were suppressed. The local frontend pack has the same profile name, so it
participated with the selected pack instead of being treated as a sibling.

Try next: change `.harnessProfile` to `backend`, dry-run, and compare which
skill and `AGENTS.md` source paths now participate.
