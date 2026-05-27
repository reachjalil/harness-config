# skills.sh Adoption

Use this when the user installed the `harness-config` skill from skills.sh or a
GitHub skill URL and wants help making the current repository use `.harness`.

The skill installation only gives the agent procedural guidance. It does not
create a repository Harness config by itself. The agent should help the user
transition the repository to `.harness` as an explicit, reviewable source of
truth.

## First Response

Explain the situation briefly:

- the skill is installed and can guide the migration;
- the repository still needs `.harness/harness.toml`, source folders, ignore
  boundaries, and activation checks;
- live agent surfaces such as `AGENTS.md`, `CLAUDE.md`, `.agents`, `.claude`,
  `.cursor`, and `.gemini` should be treated as outputs after adoption begins.

Then inspect before editing.

## Repository Triage

Check whether Harness config is already present:

```bash
test -f .harness/harness.toml && npx harnessc validate
```

Inventory current agent-facing files:

```bash
rg --files | rg '(^|/)(AGENTS.md|CLAUDE.md|\\.agents|\\.claude|\\.cursor|\\.gemini|skills|plugins|rules|prompts|commands|hooks|settings|mcp)($|/)'
```

Classify the repository into one of three paths:

- **No existing agent surfaces:** use `quick-start.md`.
- **Existing agent surfaces:** use `migration.md`.
- **Existing `.harness`:** use `cli.md` and `verification.md`.

## Transition Plan

For a repo that is not yet using `.harness`, propose or implement this sequence:

1. Create `.harness/harness.toml` with only explicit targets the user wants.
2. Create `.harness/resources` for projected target resources.
3. Create `.harness/dir` for repo-relative outputs such as `AGENTS.md` or
   `CLAUDE.md`.
4. Move durable, reviewed instructions and reusable skills into `.harness`.
5. Use target-derived overrides for target-specific differences.
6. Add `.harnessIgnore`, including `[mutable]` for runtime-owned local settings.
7. Run `npx harnessc validate`.
8. Run `npx harnessc activate` and review the dry-run plan.
9. Apply with `npx harnessc activate --yes` only when the plan matches intent.
10. Run `npx harnessc activate` again and confirm convergence.

## Installation-Friendly Defaults

When the user is coming from skills.sh, prefer defaults that are easy to review:

- use `npx harnessc` instead of assuming a local dependency;
- keep the first manifest small;
- avoid declaring targets for folders that merely happen to exist;
- keep existing live surfaces in place until activation output is understood;
- do not move secrets, credentials, caches, runtime permission grants, or local
  machine settings into `.harness`.

## User-Facing Framing

Use language like:

```text
The skill is installed, so I can guide the setup. Your repository is not using
Harness config yet, so I will first inventory existing agent files, then create
a small `.harness` source layout and validate it with `npx harnessc` before
writing any projected outputs.
```

Do not imply that installing the skill automatically activates Harness config.
The repository transition is a separate, explicit setup or migration step.
