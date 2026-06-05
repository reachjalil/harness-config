# Monorepo package wildcards

This example shows one Harness config idea for package-owned agent source:

```text
many package-owned .harness folders -> one repo-level agent projection
```

Each package owns its local Harness source under `packages/*/.harness`. The
root manifest uses wildcard `resources` and `dir` paths to collect every
package catalog into `.agents`, `.claude`, and the root `AGENTS.md`.

Use this pattern when a monorepo wants package teams to own their agent
instructions without editing a central manifest every time a package adds a
skill or instruction section.

Concepts: [manifest path patterns](../../docs/STANDARD.md#manifest),
[resources](../../docs/STANDARD.md#resources), and
[dir source](../../docs/STANDARD.md#dir-source).

Prerequisite: Node >= 22.12 with `npx harnessc` available.

## Source and generated tree

```text
packages/api/.harness/resources/       # API-owned skills
packages/api/.harness/dir/             # API-owned AGENTS.md section
packages/docs/.harness/resources/      # docs-owned prompts
packages/docs/.harness/dir/            # docs-owned AGENTS.md section
packages/web/.harness/resources/       # web-owned skills and Claude override
packages/web/.harness/dir/             # web-owned AGENTS.md section

.agents/ .claude/ AGENTS.md            # generated output
```

## Run it

```bash
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
npx harnessc activate
npx harnessc explain .agents/skills/api-contract/SKILL.md --json
npx harnessc explain .claude/hooks.json --json
```

Expected result:

- `validate` reports no Harness config issues.
- The first `activate` previews skills from every package.
- `activate --yes` writes `.agents`, `.claude`, and the composed `AGENTS.md`.
- `.claude/hooks.json` comes from the web package's target-specific override.
- `AGENTS.md` contains API, docs, and web package sections.

## What just happened

Harness expanded `packages/*/.harness/resources` and
`packages/*/.harness/dir` into deterministic source layers. Package teams can
add or remove package-local source folders without changing the root manifest,
while the generated target folders remain repo-level and predictable.

Try next: add `packages/mobile/.harness/resources/skills/mobile-flow/SKILL.md`,
dry-run, and watch the new package join the projection automatically.
