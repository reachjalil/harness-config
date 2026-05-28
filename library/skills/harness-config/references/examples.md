# Practical Examples

Use these examples as starting points. Adapt names to the user's repo instead
of forcing a taxonomy.

## Minimal Adoption

Best when a repo wants one portable skill catalog and one generated surface.

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"
```

```text
AGENTS.md
.harnessIgnore
.harness/
  harness.toml
  resources/
    README.md
    skills/
      review/
        SKILL.md
```

Keep `AGENTS.md` tracked as the bootstrap/root instruction file unless
generating it through `[[dir]]` is clearly useful.

## Skill Migration With Resource Groups

Best when existing skills/plugins/hooks serve different purposes.

```toml
version = 1

[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/resources-frontend"

[[resources]]
path = "./.harness/resources-platform"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"
```

```text
.harness/
  resources-review/
    README.md
    skills/
      code-review/
        SKILL.md
    rules/
  resources-frontend/
    README.md
    skills/
      vite-worker-imports/
        SKILL.md
    plugins/
  resources-platform/
    README.md
    hooks.json
    agents/
```

The names should match how the user thinks: workflow, team, strategy, mode,
agent set, product area, or kit. Each README should explain purpose and owner
in a few lines.

## Local Developer Overrides

Best when a developer wants experiments or personal additions without treating
generated targets as source.

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/local/resources"
```

```text
.harness/local/
  resources/
    skills/
      experimental-review/
        SKILL.md
    plugins/
    agents/
```

Suggest this `.gitignore` entry when local work should stay private:

```gitignore
.harness/local/
```

Promote useful local work by moving it into a tracked resource group and
reviewing the diff.

## Profile-Based Activation Across Resource Groups

Best when the repo has switchable modes such as `frontend`, `security-review`,
`cloudflare-react`, `team-a`, or `personal`.

```toml
[[resources]]
path = "./.harness/resources-review"

[[resources]]
path = "./.harness/resources-cloudflare-react"

[[resources]]
path = "./.harness/local/resources"
```

```text
.harnessProfile                         # contains: cloudflare-react
.harness/
  resources-review/
    skills/
      generic-review/
        SKILL.md
  resources-cloudflare-react/
    skills/
      vite-worker-imports/
        SKILL.md
      worker-deploy/
        SKILL.md
  profiles/
    cloudflare-react/
      .harnessProfileRoot               # contains: cloudflare-react
      resources-review/
        .harnessIgnore
```

Profile-local ignore:

```gitignore
# .harness/profiles/cloudflare-react/resources-review/.harnessIgnore
skills/generic-review/**
```

Use profile overlays for files the profile adds or replaces. Use profile-local
`.harnessIgnore` when the profile mainly enables or suppresses existing
resources.

## Nested `.harnessIgnore`

Best when a rule belongs next to the resource it controls.

```text
.harness/
  resources-frontend/
    .harnessIgnore
    skills/
      vite-worker-imports/
        SKILL.md
      scratch/
        SKILL.md
```

```gitignore
# .harness/resources-frontend/.harnessIgnore
skills/scratch/**
```

## Mutable Claude Settings

Best when Claude should receive a reviewed `settings.json` on first activation,
but the file may be changed by the runtime or user after that.

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.claude"
```

```text
.harness/
  resources/
    .claude/
      settings.json
      .harnessMutable

.claude/
  settings.json
```

```gitignore
# .harness/resources/.claude/.harnessMutable
settings.json
```

Activation creates `.claude/settings.json` when missing. After that, dry runs
should report it as `mutable` unless `--force-mutable` is used. Do not place
`settings.json` in `.claude/.harnessIgnore` if the repo expects fresh users to
receive the seed; target-output ignores block projection.

For selective activation inside a group:

```gitignore
# broad boundary
skills/**

# re-open one skill
!skills/
!skills/vite-worker-imports/
!skills/vite-worker-imports/**
```

Use `npx harnessc explain <path> --json` when a resource is unexpectedly
ignored or included.

## Generated Surfaces With Bootstrap

Best when `.agents`, `.claude`, `.cursor`, or `.gemini` should not clutter
version control.

Tracked bootstrap:

```text
AGENTS.md
README.md
package.json
.harness/
```

`.gitignore`:

```gitignore
.agents/
.claude/
.cursor/
.gemini/
```

Package script:

```json
{
  "scripts": {
    "setup:harness": "npx harnessc validate && npx harnessc activate --yes"
  }
}
```

Bootstrap note:

```text
Harness surfaces are generated. On fresh checkout, run:

  npx harnessc validate
  npx harnessc activate
```

Do not gitignore generated surfaces until the activation path is tracked and
obvious.
