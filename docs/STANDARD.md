# HarnessConfig Standard

HarnessConfig is a repository-local standard for durable harness resources and
repeatable target projection. It gives tools one neutral source root,
`./.harness`, one versioned TOML manifest, and one projection ignore file.

Core resource projection does not define an enable/disable registry or a
selection format. Activation is an emergent property of projection: a resource
is active in a target when that resource item is present in the computed target
tree, and it is inactive when it is absent from the next idempotent projection.
Extensions have a minimal declaration and activation policy, but extension
behavior is outside core resource projection.

## Normative Language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`, and `MAY`
are normative when they appear in uppercase.

## Versioning

The current standard version is `1`. Tools MUST reject unsupported future
versions with a clear diagnostic.

```toml
version = 1
```

Version `1` standardizes the `./.harness` root, declared resource roots,
target-derived overrides, path-only target mappings, top-level extension
declarations, copy projection, and the repo-root `.harnessIgnore` projection
ignore file.

## Scope

HarnessConfig standardizes:

- `./.harness/harness.toml`
- `./.harness/<kind>/<name>/`
- Per-resource overrides in immediate dot-prefixed folders.
- Explicit path-only target declarations.
- Top-level extension declarations.
- Copy projection from declared resources into declared targets.
- `.harnessIgnore` as the single projection filter.

HarnessConfig does not standardize product workflows, hosted services,
distribution systems, runtime behavior, grouping, selection policy, or remote
sync. Those belong in tools that build on top of this standard.

## Resource Shape

Each resource kind lives under `./.harness/<kind>`. Each resource item is a
folder. Projection copies the resource item contents into a matching target
path under the resource kind.

```text
.harness/
  skills/
    code-review/
      SKILL.md
      examples/
        checklist.md
      .claude/
        SKILL.md
  rules/
    release-policy/
      RULE.md
  plugins/
    browser-tools/
      PLUGIN.md
      .cursor/
        plugin.json
  prompts/
    incident-response/
      PROMPT.md
```

`skills`, `rules`, and `plugins` are conventional resource kinds. Their common
markdown filenames are conventions, not schema requirements. Other resource
kinds MAY exist under `./.harness/<kind>` when they follow the same folder
pattern and are declared in `harness.toml`.

## `harness.toml`

```toml
version = 1

[standard]
name = "harness-config"

[resources.skills]
path = "./.harness/skills"

[resources.prompts]
path = "./.harness/prompts"

[resources.plugins]
path = "./.harness/plugins"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[targets]]
path = "./.cursor"

[extensions.example]
version = 1
activation = "explicit"
```

### Resources

Resource ids MUST use lowercase letters, numbers, underscores, or dashes.
Resource paths MUST be repo-local and MUST NOT contain `..` segments.
Resource declarations MUST contain only `path`.

Resource declarations answer one question: which top-level source roots exist?
They do not decide which targets receive those resources.

### Targets

Every target is explicit. `./.agents` is not implicit and has no special status
in the standard. It MAY be declared as a normal target when a repository wants a
projection at that path.

Each `[[targets]]` entry declares one repo-local target path and MUST contain
only `path`.

Target paths MUST start with a dot-prefixed harness folder and MUST NOT point at
`./.harness`.

The first path segment determines the override folder:

- `./.agents` uses `.agents`.
- `./.claude` uses `.claude`.
- `./.cursor/project` uses `.cursor`.

Targets are configuration, not hidden mutation. Tools SHOULD show the target
plan before creating, replacing, copying, or removing files.

Non-normative tooling note: `harnessc` is the standard implementation and a
recommended way for users to get started with HarnessConfig. Implementations MAY
recognize common runtime surface names such as `./.agents`, `./.claude`, or
`./.cursor` to offer initialization presets or adoption hints. That recognition
does not make those folders standard requirements, reserved targets, or implicit
projection outputs. A folder receives projection only when declared as a target.

### Extensions

Extensions are declared under top-level `[extensions.<id>]` tables. Extension
ids MUST use lowercase letters, numbers, underscores, or dashes.

Each extension declaration MUST contain an integer `version`. The `version`
field is the extension configuration schema version, not the HarnessConfig
standard version.

Each extension declaration MAY contain `activation`, with values `explicit` or
`auto`. When omitted, `activation` defaults to `explicit`.

Fields other than `version` and `activation` are owned by the extension. The
HarnessConfig standard defines extension discovery, not extension behavior,
output shape, commands, or compatibility rules. Extension compatibility with
HarnessConfig versions belongs to the extension implementation metadata.

Tools MUST NOT silently apply unsupported extensions. A tool that implements an
extension MUST validate the extension-owned fields before applying that
extension's behavior.

## Routing Resource Kinds To Targets

Targets receive every declared resource root by default. A resource kind is
excluded from a target with target-scoped `.harnessIgnore` rules:

```text
# Claude should not receive plugins.
[.claude]
.harness/plugins/**

# Cursor should not receive prompts.
[.cursor]
.harness/prompts/**

# All targets except agents should skip local-only checks.
[!.agents]
.harness/checks/local-only/**
```

This is the v1 boundary:

- `harness.toml` declares resources and targets.
- `.harnessIgnore` filters source files and resource roots per target.

Tools SHOULD NOT introduce a second per-target resource mapping in
`harness.toml` for v1. Keeping target declarations path-only preserves one
place for projection filtering and makes dry-run output easier to reason about.

## Copy Projection

Activation is a repeatable copy projection from source inputs to declared
targets. The inputs are participating resource folders under `./.harness`, the
versioned `harness.toml`, target-derived override folders, and
`.harnessIgnore`. Given the same inputs, cleanup policy, and mutable policy,
activation MUST produce the same target trees every time.

A conforming tool SHOULD support a dry run that reports the actions it would
take before writing:

- `create`: a projected file does not exist in the target.
- `update`: a projected file exists with different bytes from the current
  computed projection.
- `remove`: a target entry is selected for deletion because it is not present
  in the computed projection.
- `keep`: the target file already matches the projection.
- `preserve`: a target entry is not in the computed projection and will stay
  untouched.
- `mutable`: a file declared mutable in `.harnessIgnore` already exists in the
  target, even if its bytes still match the source. The runtime owns it;
  activation MUST NOT overwrite or remove it without an explicit force
  decision.

All v1 target projections are materialized as copies. Implementations MUST NOT
require symlink support for conformance. An implementation MAY use internal
optimizations, but the observable target tree MUST behave as a copy projection
for validation, review, and repeat activation.

After activation is applied, running the same activation again SHOULD converge
to `keep` actions for managed files and `mutable` actions for files declared
mutable. That property keeps live harness folders derived and reproducible while
still letting runtimes own their per-machine configuration.

### Mutable Files

Runtimes that read live target folders may also write into them — common cases
include permission grants in `.claude/settings.local.json`, allow-listed
commands, or learned hooks. Files the runtime owns can be declared mutable in
`.harnessIgnore` under a `[mutable]` scope. Projection materializes them on
first activation (action `create`) and reports them as `mutable` on every
subsequent activation, whether or not target bytes still match the source.
Tools SHOULD offer an explicit force decision that re-projects source bytes when
the team needs to reset runtime-owned state.

The standard does not classify why a non-mutable target file differs from the
current projection. A direct-copy implementation may report that difference as
`update`. Higher-level products can add version-control-aware review,
target-to-source capture, or other workflows above this base contract.

### Unmanaged Target Entries

Target folders may already contain resources that do not come from `./.harness`.
A conforming tool MUST NOT silently delete those entries. It MUST either
preserve them or require an explicit cleanup choice before removal.

The default cleanup policy SHOULD be preserve. When a tool offers deletion, it
SHOULD summarize unmanaged target entries at one level so the plan stays
reviewable:

- For an unmanaged resource item, report the item root such as
  `skills/local-only`.
- For an unmanaged entry inside a projected resource item, report one level
  inside that item such as `skills/review/local.md` or
  `skills/review/local-assets`.
- Do not expand every descendant file in an unmanaged folder unless the user
  asks for a deeper audit.

If cleanup is selected, the plan MUST show those entries as `remove` before
writing. Applying explicit cleanup SHOULD prune empty parent directories inside
the target so a subsequent activation with unchanged inputs converges without
extra cleanup actions. If cleanup is not selected, the plan MUST show unmanaged
entries as `preserve`.

## Overrides

A dot-prefixed folder directly inside a resource item is a target override. For
target `./.claude`, the override folder is `.claude`; for target `./.agents`,
the override folder is `.agents`.

Projection MUST process each resource item in this order:

1. Copy canonical resource files, excluding immediate dot-prefixed override
   folders.
2. Merge the matching target override folder, if present.
3. Strip the override folder segment from output paths.
4. Apply `.harnessIgnore` rules to every source file before it enters the
   projection.

Override files replace canonical files only when they project to the exact same
relative file path. Override files MAY add new files. Nested dot-prefixed
folders inside an override, such as `.codex-plugin`, are ordinary output
folders unless they are the immediate resource-level override folder.

### Override Conflicts

Projection MUST reject file/directory conflicts before writing. A conflict
exists when two source files project to paths where one path requires the other
path to be a directory.

Examples:

```text
# Conflict: canonical file, override directory
.harness/skills/review/hooks
.harness/skills/review/.claude/hooks/config.json

# Conflict: canonical directory, override file
.harness/skills/review/hooks/config.json
.harness/skills/review/.claude/hooks

# Allowed: exact file replacement
.harness/skills/review/SKILL.md
.harness/skills/review/.claude/SKILL.md
```

A tool MUST report a diagnostic for the conflicting source paths and MUST NOT
apply the projection until the conflict is resolved.

## `.harnessIgnore`

`.harnessIgnore` defines files that MUST be ignored when projecting resources
into declared targets. It is repo-root because projection is a repository-level
boundary.

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/skills/*/metadata.toml
!.harness/skills/release-notes/metadata.toml

[.claude]
.harness/plugins/**

[!.cursor]
.harness/**/not-for-cursor.md

[*]
.harness/**/tmp/

[mutable]
.harness/**/settings.local.json

[mutable .claude]
.harness/skills/**/allow-list.json
```

Patterns are repo-relative. Tools MUST support blank lines, `#` comments, `!`
negation, leading `/` anchors, trailing `/` directory patterns, `*`, `**`, and
`?`.

A rule has a kind (`ignore` or `mutable`) and a target scope (`all`, `only`, or
`except`). The kind decides whether the rule excludes a file from projection or
marks it as mutable in the target. Both kinds share the same pattern grammar
and the same precedence rule: the last matching participating rule wins.

Ignore evaluation is ordered:

1. Start with `included` and `not mutable`.
2. Read rules from top to bottom.
3. A rule participates only when its scope applies to the current target.
4. For ignore rules, a matching non-negated rule changes state to `ignored`;
   a matching negated rule changes state back to `included`.
5. For mutable rules, a matching non-negated rule changes state to `mutable`;
   a matching negated rule changes state back to `not mutable`.
6. The last matching participating rule of each kind wins.

Scope sections affect subsequent rules. A section header may set kind and
target scope together:

- `[*]` or `[global]` applies subsequent ignore rules to every target.
- `[.claude]` applies subsequent ignore rules only to target `.claude`.
- `[!.cursor]` applies subsequent ignore rules to every target except `.cursor`.
- `[mutable]` applies subsequent mutable rules to every target.
- `[mutable .claude]` applies subsequent mutable rules only to target `.claude`.
- `[mutable !.cursor]` applies subsequent mutable rules to every target except
  `.cursor`.
- A subsequent ignore-scope header switches kind back to `ignore`.

Mutable files MUST still flow through the projection ignore step. If a file is
both ignored and marked mutable, the ignore decision wins because the file
never enters the projection in the first place.

A trailing `/` pattern is directory-only. It matches the directory itself only
when the candidate is a directory, and it matches descendants of that directory.

## Reviewability

The source/projection boundary makes cross-harness differences reviewable:

- A diff in a resource root affects every target that projects that resource.
- A diff under `.agents`, `.claude`, `.cursor`, or another override folder
  affects only targets that use that override.
- A diff in `.harnessIgnore` changes projection boundaries.
- A diff in `harness.toml` changes declared resource roots and target paths.

## Safety Requirements

- Validation MUST be read-only.
- Paths MUST stay inside the repository.
- Initialization commands MUST explain planned filesystem changes before mutation.
- Activation commands SHOULD offer a dry run and explain creates, updates,
  removals, keeps, unmanaged preserved entries, and mutable skips before
  mutation.
- Live harness folders MUST be treated as projection targets, not source
  repositories.
- Activation MUST be idempotent for the same `.harness`, `harness.toml`,
  `.harnessIgnore`, participating resources, cleanup policy, and mutable
  policy.
- Projection MUST honor `.harnessIgnore` so logs, metadata, caches, and
  implementation state stay out of runtime folders.
- Tools MUST merge target-derived overrides when present and fall back to the
  canonical files when no override exists.
- Unknown `./.harness/<kind>` folders MAY be used when declared in
  `harness.toml`.
- Mutable files MUST be created on first projection and MUST be skipped on
  subsequent projections unless the user explicitly opts in to force a
  re-projection.
