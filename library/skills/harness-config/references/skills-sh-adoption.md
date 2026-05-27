# skills.sh Adoption

Use this when the user installed the `harness-config` skill from skills.sh or a
GitHub skill URL and wants help making the current repository use `.harness`.

The skill installation only gives the agent procedural guidance. It does not
create a repository Harness config by itself. The agent should help the user
transition the repository to `.harness` as an explicit, reviewable source of
truth.

Prefer `npx harnessc` for supported operations: validation, dry-run activation,
apply, convergence checks, and initialization when the default generated layout
matches the user's intent. Use ordinary file edits for the migration work that
requires judgment: moving existing instructions, splitting shared content from
target-specific wrappers, writing `.harnessIgnore`, composing root instruction
files, and preserving runtime-owned local state.

## First Response

Explain the situation briefly:

- the skill is installed and can guide the migration;
- the repository still needs `.harness/harness.toml`, source folders, ignore
  boundaries, and activation checks;
- live agent surfaces such as `AGENTS.md`, `CLAUDE.md`, `.agents`, `.claude`,
  `.cursor`, and `.gemini` should be treated as outputs after adoption begins.
- `npx harnessc` should be used whenever it can validate, preview, or apply the
  supported transition; manual file edits should be reserved for source content
  and migration choices.

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
4. Offer optional `.harness/local/resources` and `.harness/local/dir` roots
   for personal overrides or experiments when the user wants them.
5. Move durable, reviewed instructions and reusable skills into `.harness`.
6. Use target-derived overrides for target-specific differences.
7. Add `.harnessIgnore`, including `[mutable]` for runtime-owned local settings.
8. Run `npx harnessc validate`.
9. Run `npx harnessc activate` and review the dry-run plan.
10. Apply with `npx harnessc activate --yes` only when the plan matches intent.
11. Run `npx harnessc activate` again and confirm convergence.

After triage, summarize the plan to the user in terms of supported CLI steps
and file-edit steps. Example:

```text
I can use `npx harnessc validate` and `npx harnessc activate` to verify the
projection, but the actual migration of your existing AGENTS.md and .claude
skill content into `.harness` needs regular file edits because it is a source
design decision.
```

## Installation-Friendly Defaults

When the user is coming from skills.sh, prefer defaults that are easy to review:

- use `npx harnessc` instead of assuming a local dependency;
- keep the first manifest small;
- add local source roots only when they help the user's workflow, and suggest
  `.harness/local/` in `.gitignore` only if the user wants those overrides
  private;
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
