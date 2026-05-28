# Harness Conversion Scenarios

Use this when a repository already has one or more agent harness surfaces and
the user wants to convert them into Harness config. This reference adapts the
cross-harness compatibility model into `.harness` source roots, explicit
targets, target-derived overrides, and activation checks.

Start by explaining the conversion opportunities to the user: what can become
shared source, what needs target-specific wrappers, what should remain
runtime-owned, and which steps can be handled by `npx harnessc` versus ordinary
file edits. Prefer `npx harnessc validate`, `npx harnessc activate`,
`npx harnessc explain`, and `npx harnessc activate --yes` whenever the CLI
supports the operation. Use manual file edits for content migration,
manifest/source authoring, and harness-specific wrapper design.

## Contents

- [Core Conversion Model](#core-conversion-model)
- [Target Mapping](#target-mapping)
- [Scenario: Resource Groups](#scenario-resource-groups)
- [Scenario: Merge Duplicate Skills](#scenario-merge-duplicate-skills)
- [Scenario: Root Instructions](#scenario-root-instructions)
- [Scenario: Codex Plugin](#scenario-codex-plugin)
- [Scenario: Claude Plugin](#scenario-claude-plugin)
- [Scenario: Gemini Extension](#scenario-gemini-extension)
- [Scenario: Cursor Configuration](#scenario-cursor-configuration)
- [Scenario: Hooks](#scenario-hooks)
- [Scenario: MCP Servers](#scenario-mcp-servers)
- [Scenario: Rules, Commands, and Subagents](#scenario-rules-commands-and-subagents)
- [Scenario: Multi-Harness Plugin Pack](#scenario-multi-harness-plugin-pack)
- [Security Review](#security-review)
- [Merge Checklist](#merge-checklist)

## Core Conversion Model

Separate every existing file into one of four layers:

1. **Portable content:** skills, references, scripts, prompts, reusable MCP
   server code, shared rule text, and reusable hook scripts.
2. **Harness discovery paths:** `.agents`, `.claude`, `.gemini`, `.cursor`,
   root instruction files, plugin roots, extension roots, marketplace files, and
   settings files that each tool scans.
3. **Packaging wrappers:** `.codex-plugin/plugin.json`,
   `.claude-plugin/plugin.json`, `gemini-extension.json`, Cursor marketplace or
   plugin packaging, and local marketplace catalogs.
4. **Runtime trust and local state:** permissions, secrets, hook trust,
   approval policy, local settings, caches, logs, and generated files.

Map these layers into Harness config:

- Put portable target resources under configured `.harness/resources*` roots.
- Group resources by usefulness: workflow, strategy, team, mode, agent set,
  product area, or kit. Match the user's language.
- Put repo-relative outputs under `.harness/dir*` only when generation,
  composition, profile overlays, or local overlays are useful.
- Represent harness-specific differences with target-derived overrides such as
  `.harness/resources/.claude/...` or
  `.harness/resources/skills/review/.claude/SKILL.md`.
- Keep local runtime state outside `.harness`, or seed it once through
  `.harnessMutable` rules.
- Declare each live harness surface explicitly in `.harness/harness.toml`.

## Target Mapping

Declare only the targets the user actually wants to project:

```toml
version = 1

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.gemini"

[[targets]]
path = "./.cursor"

[[resources]]
path = "./.harness/resources"
```

Do not add a target just because a folder exists. First classify whether the
folder is durable source, generated output, runtime state, or obsolete.

## Scenario: Resource Groups

Use this when a repo has enough skills, plugins, hooks, rules, prompts, or
agents that one flat `.harness/resources` folder would hide intent.

```text
.harness/
  resources-review/
    README.md
    skills/
    rules/
  resources-frontend/
    README.md
    skills/
    plugins/
  resources-platform/
    README.md
    hooks.json
    agents/
```

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/resources-frontend"

[[resources]]
path = "./.harness/resources-platform"
```

Rules:

- Name groups for how the user will use them, not just file type.
- Add short README files for non-obvious groups.
- Keep resource groups copy/pasteable between projects.
- Use profiles and nested `.harnessIgnore` to switch groups or selected
  resources on and off.
- Use `.harness/local/resources` for personal experiments and private
  additions.

## Scenario: Merge Duplicate Skills

Use this when the same or similar `SKILL.md` folders exist under multiple
harness surfaces.

Before:

```text
.agents/skills/review/SKILL.md
.claude/skills/review/SKILL.md
.cursor/skills/review/SKILL.md
```

After, in the resource group that matches how the user thinks about the skill:

```text
.harness/resources-review/skills/review/SKILL.md
.harness/resources-review/skills/review/references/
.harness/resources-review/skills/review/scripts/
```

If one harness needs different wording or support files, add an override:

```text
.harness/resources-review/skills/review/SKILL.md
.harness/resources-review/skills/review/.claude/SKILL.md
.harness/resources-review/skills/review/.cursor/SKILL.md
```

Rules:

- Keep `name` stable and kebab-case.
- Keep portable instructions in the base skill.
- Put tool-specific invocation notes, plugin namespacing, or limitations in the
  override only when necessary.
- Reference supporting files from `SKILL.md`; do not assume the harness will
  discover them semantically.

## Scenario: Root Instructions

First assess whether root instruction files should stay normal tracked files or
become generated repo-relative outputs. Keep them as normal files when they are
simple and already coherent. Use configured `[[dir]]` roots such as
`.harness/dir` when generation creates a cleaner setup:

```text
.harness/dir/AGENTS.md/
  .harnessComposable
  100_project.md
  200_workflows.md

.harness/dir/CLAUDE.md/
  .harnessComposable
  .harnessRef
  300_claude_tail.md

.harness/dir/GEMINI.md/
  .harnessComposable
  .harnessRef
  300_gemini_tail.md
```

Use `AGENTS.md` as the shared base when appropriate. Use `.harnessRef` so
Claude or Gemini instructions can import the shared base and add a short
target-specific tail.

Do not copy long procedural workflows into every root instruction file. Convert
long procedures into skills and leave a short pointer in always-on
instructions. Do not split root instruction files into composable parts unless
the split removes real duplication, supports profiles/local layers, or improves
review.

## Scenario: Codex Plugin

Codex plugin roots commonly contain:

```text
plugins/my-plugin/
  .codex-plugin/plugin.json
  skills/
  hooks/hooks.json
  .mcp.json
  assets/
```

Conversion pattern:

```text
.harness/resources-platform/plugins/my-plugin/.codex-plugin/plugin.json
.harness/resources-platform/plugins/my-plugin/skills/
.harness/resources-platform/plugins/my-plugin/hooks/hooks.json
.harness/resources-platform/plugins/my-plugin/.mcp.json
```

Project to `.agents` when the repository wants Codex to receive the plugin
tree:

```toml
[[targets]]
path = "./.agents"
```

For local marketplaces:

```text
.harness/resources-platform/plugins/marketplace.json
```

or, when the marketplace should live at a repo-relative path outside `.agents`,
compose or copy it through `.harness/dir`.

Rules:

- Only `.codex-plugin/plugin.json` belongs inside `.codex-plugin/`.
- Skills, hooks, MCP config, assets, and app config live at the plugin root.
- Do not assume Codex plugin manifests are valid for Claude, Gemini, or Cursor.

## Scenario: Claude Plugin

Claude plugin roots commonly contain:

```text
plugins/my-plugin/
  .claude-plugin/plugin.json
  skills/
  commands/
  agents/
  hooks/hooks.json
  .mcp.json
  settings.json
```

Conversion pattern:

```text
.harness/resources-platform/plugins/my-plugin/.claude-plugin/plugin.json
.harness/resources-platform/plugins/my-plugin/skills/
.harness/resources-platform/plugins/my-plugin/commands/
.harness/resources-platform/plugins/my-plugin/agents/
.harness/resources-platform/plugins/my-plugin/hooks/hooks.json
.harness/resources-platform/plugins/my-plugin/.mcp.json
```

Use `.claude` target overrides when Claude needs a different package wrapper
than Codex:

```text
.harness/resources-platform/plugins/my-plugin/.codex-plugin/plugin.json
.harness/resources-platform/plugins/my-plugin/.claude/.claude-plugin/plugin.json
```

Rules:

- Only `plugin.json` belongs inside `.claude-plugin/`.
- Keep plugin root components at the plugin root.
- Treat plugin settings and hook trust as runtime-sensitive; do not project
  secrets or local machine settings.
- If a non-secret Claude `settings.json` should be available on first
  activation and then runtime-owned, seed it beside a source-local
  `.harnessMutable` file:

```text
.harness/resources/.claude/settings.json
.harness/resources/.claude/.harnessMutable
```

```gitignore
# .harness/resources/.claude/.harnessMutable
settings.json
```

Do not put `settings.json` in `.claude/.harnessIgnore` when the desired
behavior is seed-once projection. Target-output ignores block projection;
mutable rules project once and then preserve runtime edits.

## Scenario: Gemini Extension

Gemini extensions commonly contain:

```text
extensions/my-extension/
  gemini-extension.json
  GEMINI.md
  skills/
  commands/
  hooks/hooks.json
  agents/
  policies/
```

Conversion pattern:

```text
.harness/resources/extensions/my-extension/gemini-extension.json
.harness/resources/extensions/my-extension/GEMINI.md
.harness/resources/extensions/my-extension/skills/
.harness/resources/extensions/my-extension/commands/
.harness/resources/extensions/my-extension/hooks/hooks.json
```

If the extension should be a repo-relative installable bundle rather than a
`.gemini` target output, project it through `.harness/dir`:

```text
.harness/dir/extensions/my-extension/gemini-extension.json
.harness/dir/extensions/my-extension/skills/
```

Rules:

- `gemini-extension.json` is Gemini-specific.
- Extension hooks usually live under `hooks/hooks.json`.
- Keep `${extensionPath}` or other host variables in Gemini-specific wrappers,
  not shared scripts.

## Scenario: Cursor Configuration

Cursor surfaces change quickly, so preserve user intent and avoid overfitting
to one observed schema.

Common inputs:

```text
.cursor/rules/
.cursor/skills/
.cursor/mcp.json
.cursor/*.json
```

Conversion pattern:

```text
.harness/resources/rules/cursor/
.harness/resources/skills/<skill>/.cursor/SKILL.md
.harness/resources/.cursor/mcp.json
```

Rules:

- Treat Cursor rules as always-on policy, not procedural skill content.
- Convert long procedural Cursor rules into portable skills where possible.
- Keep MCP config project-scoped only when secrets are not embedded.
- Verify current Cursor docs before changing hook or plugin schemas.

## Scenario: Hooks

Hook scripts are often portable; hook declarations usually are not.

Conversion pattern:

```text
.harness/resources/hooks/shared/guard_write.py
.harness/resources/hooks/codex/hooks.json
.harness/resources/hooks/claude/hooks.json
.harness/resources/hooks/gemini/hooks.json
.harness/resources/.agents/hooks/hooks.json
.harness/resources/.claude/hooks/hooks.json
.harness/resources/.gemini/hooks/hooks.json
```

Rules:

- Keep shared command scripts in one place.
- Use target-specific hook JSON wrappers for event names, matchers, timeouts,
  and output schemas.
- Make scripts time-bounded and safe for untrusted repositories.
- Send debug logs to stderr when a harness expects strict JSON on stdout.
- Do not project hook trust decisions, secrets, or local allowlists unless the
  user explicitly wants managed policy.

Use `.harnessMutable` for target-local hook state or logs if a seed file must
be created once.

## Scenario: MCP Servers

MCP server implementation code can be shared, while config wrappers are usually
harness-specific.

Conversion pattern:

```text
.harness/resources/mcp-servers/docs/
.harness/resources/.agents/.mcp.json
.harness/resources/.claude/.mcp.json
.harness/resources/.gemini/settings.json
.harness/resources/.cursor/mcp.json
```

Rules:

- Commit server code and non-secret config.
- Keep API keys, OAuth tokens, and local credentials out of `.harness`.
- Use target-specific wrappers for command paths, environment variable names,
  and approval policy.
- Prefer explicit command and args arrays.
- Test one safe tool call per target harness after activation.

## Scenario: Rules, Commands, and Subagents

Classify text before moving it:

- Always-on coding standards belong in root instructions or rule files.
- Procedural workflows belong in skills.
- Slash commands or command prompts belong in harness-specific command folders.
- Subagents or named agents belong in target-specific agent folders unless a
  portable prompt can be shared.

Conversion examples:

```text
.harness/dir/AGENTS.md/
.harness/dir/CLAUDE.md/
.harness/resources/.cursor/rules/
.harness/resources/.claude/commands/
.harness/resources/.gemini/commands/
.harness/resources/.claude/agents/
.harness/resources/.gemini/agents/
```

When two harnesses have similar commands, extract shared instructions into a
skill and leave thin command wrappers that invoke or describe when to use the
skill.

## Scenario: Multi-Harness Plugin Pack

For a shared plugin or extension pack, use one portable component tree plus
thin manifest wrappers:

```text
.harness/resources/plugins/platform-pack/
  skills/
    policy-review/
      SKILL.md
      references/
  hooks/
    shared/
    codex.json
    claude.json
    gemini.json
  mcp-servers/
    docs/
  .codex-plugin/
    plugin.json
  .claude-plugin/
    plugin.json
  gemini-extension.json
```

If different target surfaces need different layouts, use target-derived
overrides:

```text
.harness/resources/plugins/platform-pack/.claude/.claude-plugin/plugin.json
.harness/resources/plugins/platform-pack/.gemini/gemini-extension.json
```

Rules:

- Do not expect one manifest to load in every harness.
- Keep component directories shared where possible.
- Keep wrappers thin and explicit.
- Validate every target harness separately.

## Security Review

Before running or projecting active harness behavior, review trust boundaries:

- Do not move secrets, credentials, OAuth tokens, API keys, machine-local
  settings, generated auth files, logs, or caches into `.harness`.
- Do not execute migrated hook scripts, plugin install scripts, MCP servers, or
  generated shell commands until the user has reviewed what they do.
- Treat hook trust, MCP approval policy, local plugin trust, and tool allowlists
  as runtime state unless the user explicitly wants managed policy.
- Keep shared scripts small, readable, and time-bounded.
- Prefer dry-run activation before writing outputs.
- Use `.harnessMutable` for files that should be seeded once and then left
  runtime-owned. Show the seed and declaration path, for example
  `.harness/resources/.claude/settings.json` plus
  `.harness/resources/.claude/.harnessMutable`.
- Preserve existing live outputs until `npx harnessc activate` explains the
  planned creates, updates, mutable entries, and preserves.
- Replace target symlinks only after checking where they point and confirming
  the dry-run plan. If the symlink and source files are tracked, explain that
  git makes the change easy to review and revert. Stop before replacing
  symlinks that point outside the repo or into secrets/runtime state.

## Merge Checklist

Before applying activation:

- [ ] Every live output folder is declared as an explicit target.
- [ ] Durable reusable content lives under `.harness/resources` or another
      configured resource group.
- [ ] Repo-relative generated outputs live under `.harness/dir` only when
      useful.
- [ ] Resource groups have names and README files that make their purpose clear
      when copied to another project.
- [ ] Harness-specific differences are encoded as target-derived overrides.
- [ ] Runtime state, secrets, caches, logs, and machine-local settings are not
      in `.harness`.
- [ ] `.harnessMutable` covers files that should be seeded once and then
      runtime-owned, with source seeds shown in the plan.
- [ ] Plugin and extension manifests stay in their harness-specific wrapper
      paths.
- [ ] Hook scripts are shared only when their stdin/stdout contracts are valid
      for every wrapper that calls them.
- [ ] MCP config wrappers do not embed secrets.
- [ ] `npx harnessc validate` passes.
- [ ] `npx harnessc activate` produces an expected dry-run plan before
      `--yes` is used.
