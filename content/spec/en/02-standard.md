---
title: Standard
seoTitle: .harness Config Standard
socialTitle: The .harness repository configuration standard
description: Normative definitions for the .harness source layout, activation projection, target-derived overrides, .harnessIgnore precedence, profile overlays, and conformance boundaries.
socialDescription: Normative definitions for source resources, targets, overrides, ignores, profile overlays, extensions, and activation behavior.
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: en
sectionCode: "02"
summary: Normative definitions for terms, repository shape, TOML, projection, overrides, ignores, profiles, extensions, and conformance.
llmSummary: Defines the .harness repository shape, TOML contract, activation projection, target-derived overrides, ignore precedence, profile overlays, extension declarations, and conformance boundaries.
audience: Tool authors, standard reviewers, and technical implementers.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Harness config Standard

**Status:** Version 1 — Stable. The file shape, manifest schema, projection
contract, and ignore grammar described here are intended to be implementable
without consulting the reference code. Changes that would invalidate a v1
repository or v1 implementation are reserved for v2.

Harness config is a repository-local standard for declaring durable agent
*harness resources* (the prompts, skills, rules, plugins, and similar files
that condition an AI coding agent's behavior) and projecting them into
runtime-facing folders in a reviewable, reproducible way.

A repository keeps neutral source roots and projects them into declared target
folders. The default manifest is `./.harness/harness.toml`; tools MAY also use another
repo-local TOML file when that path is explicitly selected. Durable resources
live under the configured resources source root, which defaults to
`./.harness/resources`. Repo-relative one-off outputs live under the optional
`[dir]` source, which defaults to `./.harness/dir` when `[dir]` is declared.
The `./.harness` directory is therefore a convention for source storage, not
the required location of the manifest. Projection is filtered through
`.harnessIgnore` rule files. The repo-root `./.harnessIgnore` sets
repository-wide boundaries, while local `.harnessIgnore` files may sit beside
source or target-output subtrees. Every target-output folder that receives a
projection is explicit; there are no implicit targets and no reserved target
folder names.

Core resource projection intentionally does not define an enable/disable
registry or a selection format. Activation is an emergent property of
projection: a resource is *active* in a target when its files are present in
the computed target tree, and *inactive* when they are absent from the next
projection. Selection, grouping, marketplace behavior, and similar concerns
belong in product layers above the standard.

Extensions have a minimal declaration and activation policy at the standard
layer; the per-extension behavior is owned by each extension.

## Normative Language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`, `SHALL NOT`, `SHOULD`,
`SHOULD NOT`, `RECOMMENDED`, `MAY`, and `OPTIONAL` in this document are to be
interpreted as described in [RFC 2119] and [RFC 8174] when, and only when,
they appear in all capitals, as shown here.

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174

## Terminology

These terms have specific meanings throughout this document. Where a section
later in the document gives a more detailed definition, that section is
authoritative.

- **Harness** — the collection of files an AI agent or developer-facing tool
  reads as instructions, context, or configuration for a repository.
- **Convention root** — the directory `./.harness` at the root of a
  repository, commonly used for resources, dir source files, profiles, and
  other source storage. It is not the required manifest location.
- **Manifest** — the selected repo-local TOML file, defaulting to
  `./.harness/harness.toml`, which declares the standard version, resources source,
  targets, the optional dir source, and extensions.
- **Resources source** — the repo-local directory declared by `[resources]`
  `path`, defaulting to `./.harness/resources`, whose contents are projected
  into every declared target.
- **Resource kind** — a category of source material such as
  `skills`, `rules`, `hooks`, or `plugins` under the resources source.
  Kinds are directory names, not reserved schema concepts.
- **Resource item** — commonly one folder under
  `<resources>/<kind>/<name>`, such as
  `./.harness/resources/skills/review`. Item folders are conventional units
  of review, but the resources source may also contain direct files such as
  `./.harness/resources/hooks.json`.
- **Target** — a repository-local directory declared in the selected manifest
  that receives copy projections of the resources source.
- **Override folder** — an immediate dot-prefixed subfolder inside a resource
  item (for example `.claude/` inside
  `./.harness/resources/skills/review/`) or directly inside
  `./.harness/resources` whose files replace or add to canonical files when
  projecting to the matching target.
- **Dir source** — an optional repo-local directory (default
  `./.harness/dir`) declared by the top-level `[dir]` table. Its contents
  project either by composition (a directory marked with
  `.harnessComposable` whose numbered parts concatenate into one output
  file) or by direct copy (any other directory or file under the dir source
  copies to the matching repo-relative path).
- **Composable marker** — the empty file `.harnessComposable` placed inside
  a dir directory to mark it as a composable leaf. Without the marker, the
  directory is treated as a copy folder.
- **Projection** — the computed mapping from `(source root, manifest,
  configured sources, overrides, ignore rules)` to a per-target file tree.
- **Activation** — the act of materializing a projection into one or more
  target folders on disk.
- **Mutable file** — a target file that the runtime owns after first
  projection, declared with a `[mutable]` rule in `.harnessIgnore`.
- **Conforming repository / tool** — see [Conformance](/specifications/v1/conformance/).

## Versioning

The current standard version is `1`. Specification versions are full standard
versions. Patch, minor, prerelease, and package versions belong to CLI,
tooling, extension, and implementation releases, not to the specification URL
space or manifest `version` field.

Implementations MUST reject selected manifest files whose top-level `version`
is not a supported integer, with a diagnostic that names both the encountered
value and the supported version(s).

```toml
version = 1
```

Version `1` standardizes:

- the `./.harness` convention root,
- the selected TOML manifest schema for path-only targets,
  configurable `[resources]`, the optional `[dir]` source root, and top-level
  extension declarations,
- the configured resources source tree,
- target-derived override folders,
- copy projection (idempotent under fixed inputs),
- the `[dir]` composition (`.harnessComposable` leaves) and copy contract
  for files that project to repo-relative paths,
- `.harnessIgnore` projection ignore files, including repo-root rules,
  source-local rules, target-output-local rules, and `[mutable]` sections.

Within v1, this document MAY receive editorial clarifications and
backward-compatible normative refinements (for example, optional fields with
defined defaults). Changes that would invalidate a v1 repository or v1
implementation are reserved for v2.

## Scope

Harness config standardizes:

- the selected manifest file and its schema,
- the resource layout under the configured resources source,
- per-resource target overrides as immediate dot-prefixed folders,
- explicit, path-only target declarations,
- the optional `[dir]` source root, with composable (`.harnessComposable`)
  leaves and copy-mode directories that project to repo-relative paths,
- top-level extension declarations (discovery and activation policy only),
- copy projection from the resources source to declared targets,
- `.harnessIgnore` as the single projection filter, including target-output
  exclusions and mutable-file rules.

### Out of Scope

Harness config does **not** standardize:

- product workflows, command surfaces, or end-user UX,
- hosted services, registries, or marketplaces,
- distribution, dependency resolution, or package management for resources,
- agent runtime behavior or how runtimes consume target files,
- skill, prompt, or rule schemas beyond "folder with files",
- selection, grouping, sessions, presets, or kits,
- target-to-source capture or reverse projection,
- target edit review workflows (see [Mutable Files](#mutable-files) for the
  base contract),
- remote sync, telemetry, or audit logging.

These concerns belong in tools, products, or organizational policies that
build on top of the standard. Keeping them out of v1 is what lets multiple
implementations interoperate on the same configured source trees.

## Resource Shape

The resources source is a repo-local directory selected by the manifest. Its
default path is `./.harness/resources`; a manifest MAY declare another
repo-local path with `[resources] path = "./path"`. Its contents project into
each declared target with the same relative paths. Resource kinds such as
`skills`, `rules`, `hooks`, and `plugins` are ordinary directories below that
source. Direct files are allowed, so a repository can carry target-root
configuration such as `hooks.json` without inventing a resource item folder.

```text
.harness/
  resources/
    hooks.json
    hooks/
      post-tool-use.sh
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
    .gemini/
      hooks.json
```

`skills`, `rules`, and `plugins` are conventional resource kinds. Their common
markdown filenames are conventions, not schema requirements. Other resource
kinds MAY exist under the resources source without per-kind manifest
declaration.

Any directory under the resources source MAY be a composable file source
when it contains an empty `.harnessComposable` marker. The directory name is
the projected file path, and its numeric-prefix parts compose with the same
`.harnessRef` and `.harnessIgnore` semantics defined for `[dir]` composable
leaves. For example,
`./.harness/resources/skills/review/SKILL.md/.harnessComposable` projects one
target file at `skills/review/SKILL.md`; the numbered files inside that
directory are not projected individually.

An immediate dot-prefixed directory directly under the resources source is a
target-root override. For target `./.gemini`, files under the default
`./.harness/resources/.gemini/` overlay the canonical resources source and the
`.gemini` segment is stripped from the output path. This is how
target-specific root files such as `.gemini/hooks.json` are represented.

An immediate dot-prefixed directory inside a conventional resource item, such
as `./.harness/resources/skills/code-review/.claude/` under the default
resources source, is an item-level target override. Its files overlay that
item and the override segment is stripped from the output path.

## Manifest

```toml
version = 1

[standard]
name = "harness-config"

[resources]
path = "./.harness/resources"

[[targets]]
path = "./.claude"

[[targets]]
path = "./runtime/agent"

[dir]
path = "./.harness/dir"

[extensions.example]
version = 1
activation = "explicit"
```

### Resources

Resource projection uses the configured resources source root. If `[resources]`
is omitted, the default is `./.harness/resources`.

The optional `[resources]` table MAY contain only `path`. The path MUST be
repo-local, MUST resolve inside the repository, and MUST NOT contain `..`
segments. A manifest MUST NOT contain any `[resources.<kind>]` tables; resource
kinds remain source-tree names, not manifest schema entries.

Top-level resource directory names SHOULD use lowercase letters, numbers,
underscores, or dashes. Dot-prefixed names directly under
the resources source are target-root overrides, not shared canonical output
folders. Resource files and directories MUST NOT rely on path traversal; all
projected output paths MUST remain inside their declared target.

### Targets

Every target is explicit. Harness config does not reserve, prefer, or imply any
runtime target folder name. Each `[[targets]]` entry in the selected manifest
declares one repo-local target path and MUST contain only `path`.

Target paths MUST resolve inside the repository, MUST point at a folder below
the repository root, MUST NOT contain `..` segments after normalization, MUST
NOT point at `./.harness` itself or any descendant of it, and MUST NOT overlap
configured source roots such as `[resources]` or `[dir]`.

The override folder for a target is the first path segment after the leading
`./`, normalized to a dot-prefixed source override folder. This keeps target
paths unconstrained while preserving the source-tree convention that immediate
dot-prefixed folders inside a resource item are overrides. After path
normalization (collapsing duplicate separators and removing leading `./`):

- `./.agents` → override folder `.agents`.
- `./.claude` → override folder `.claude`.
- `./runtime/agent` → override folder `.runtime`.
- `./.github/copilot/agents` → override folder `.github`.

Two `[[targets]]` entries whose normalized paths are equal are duplicates and
MUST be rejected with a diagnostic.

Targets are configuration, not hidden mutation. Tools SHOULD show the target
plan before creating, replacing, copying, or removing files.

### Extensions

Extensions are declared under top-level `[extensions.<id>]` tables. Extension
ids MUST use lowercase letters, numbers, underscores, or dashes, and MUST
begin with a letter.

Each extension declaration MUST contain a positive integer `version`. This is
the extension's own configuration schema version, not the Harness config
standard version.

Each extension declaration MAY contain `activation` with one of two values:

- `"explicit"` (default): the extension runs only when a user or tool
  explicitly invokes it.
- `"auto"`: the extension MAY run as part of routine activation flows offered
  by a tool.

When omitted, `activation` defaults to `"explicit"`.

Fields other than `version` and `activation` are owned by the extension. The
Harness config standard defines extension *discovery* (how a tool sees that an
extension is declared) and *activation policy* (whether a tool may run it
without explicit user action). It does not define extension behavior, output
shape, commands, or compatibility rules. Extension compatibility with
Harness config versions belongs to the extension implementation metadata.

A tool that encounters an `[extensions.<id>]` table for an extension it does
not implement MUST NOT apply that extension's behavior, MUST NOT fail
validation of the manifest solely because of the unknown extension, and
SHOULD report the unknown extension as informational so users can decide
whether to install support.

A tool that does implement an extension MUST validate the extension-owned
fields before applying that extension's behavior.

## Encoding, Paths, and Case Sensitivity

These rules apply to every file the standard reads or writes (the selected
manifest, `.harnessIgnore`, projected files, and override files) unless an
extension explicitly defines its own.

- **Text encoding.** Configuration files (the selected manifest,
  `.harnessIgnore`) MUST be UTF-8. A leading UTF-8 BOM MAY be present and
  MUST be ignored when parsing. Resource file contents are copied
  byte-for-byte; the standard does not require any encoding for resource
  payloads.
- **Line endings.** The standard does not normalize line endings. Projection
  copies bytes exactly, so a target file's line endings match the source.
- **Path separators.** Manifest and ignore patterns use forward slashes
  (`/`). Implementations on platforms with a different native separator MUST
  translate at the filesystem boundary; user-visible diagnostics SHOULD use
  forward slashes for portability.
- **Path normalization.** Before comparison, implementations MUST collapse
  duplicate separators, remove leading `./`, and reject `..` segments. Paths
  MUST resolve inside the repository.
- **Case sensitivity.** Path comparisons (target equality, override
  matching, ignore matching) are **case-sensitive**. Repositories that may
  be cloned onto case-insensitive filesystems (such as default macOS or
  Windows volumes) SHOULD avoid names that differ only in case, because the
  underlying filesystem may collapse them. Implementations MAY warn when
  they detect such collisions.
- **Symlinks.** A symlink encountered inside configured source roots,
  `./.harness`, or a declared target tree SHOULD be reported as a diagnostic.
  v1 implementations are not required to follow symlinks during projection.
  The reference implementation rejects symlinked target paths and nested
  target symlinks before applying activation.
- **Hidden files.** Names beginning with `.` are not implicitly ignored.
  They participate in projection like any other file unless excluded by
  `.harnessIgnore`.

## Routing Resources To Targets

Targets receive the configured resources source tree by default. A resource
kind, direct file, or subtree is excluded from one target with a
target-output-local
`.harnessIgnore` file:

```text
# .claude/plugins/.harnessIgnore
*

# .cursor/prompts/.harnessIgnore
*

# .agents/checks/.harnessIgnore
local-only/
```

This is the v1 boundary:

- the selected manifest declares targets.
- the configured resources source carries the target resource tree.
- `.harnessIgnore` filters source files and target output subtrees.

Tools SHOULD NOT introduce per-target resource mappings in the selected
manifest for v1. Keeping target declarations path-only and resources as one
configured source root preserves one place for projection filtering and makes
dry-run output easier to reason about.

## Copy Projection

Activation is a repeatable copy projection from source inputs to declared
targets. The inputs are:

1. the participating files, composable leaves, and folders under
   the configured resources source, including their override folders,
2. the selected versioned manifest,
3. the repo-root `.harnessIgnore`,
4. the cleanup policy (preserve unmanaged entries vs. remove them),
5. the mutable policy (skip mutable files vs. force re-projection).

**Idempotence (testable property).** Let `T_n` be the on-disk tree of a
declared target after the `n`-th activation against an unchanged set of
inputs (1)–(5). For every `n ≥ 2`:

- the set of files in `T_n` MUST equal the set in `T_1`,
- every managed (non-mutable) file in `T_n` MUST be byte-identical to its
  counterpart in `T_1`,
- every mutable file present in `T_1` MUST remain present in `T_n` with the
  same bytes it had at the end of activation `n − 1` (i.e., the runtime owns
  it; activation does not write to it), and
- no extra filesystem writes to managed files SHOULD occur beyond what
  is required to converge.

This property is what makes activation reviewable: a clean re-run against
unchanged inputs is observable as a `keep`-only plan for managed files and a
`mutable`-only plan for mutable files.

A conforming tool SHOULD support a dry run that reports the actions it would
take before writing:

- `create`: a projected file does not exist in the target.
- `update`: a projected file exists with different bytes from the current
  computed projection.
- `remove`: a target entry is selected for deletion because it is not present
  in the computed projection.
- `keep`: the target file already matches the projection.
- `preserve`: an existing entry inside a declared target is not in the
  computed projection and will stay untouched.
- `mutable`: a file declared mutable in `.harnessIgnore` already exists in the
  target, even if its bytes still match the source. The runtime owns it;
  activation MUST NOT overwrite or remove it without an explicit force
  decision.

These actions describe files and directories inside declared targets. Source
files under configured source roots are projection inputs; activation does
not classify them as `keep`, `preserve`, or `remove`.

All v1 target projections are materialized as copies. Implementations MUST NOT
require symlink support for conformance. An implementation MAY use internal
optimizations, but the observable target tree MUST behave as a copy projection
for validation, review, and repeat activation.

After activation is applied, running the same activation again SHOULD converge
to `keep` actions for managed files and `mutable` actions for files declared
mutable. That property keeps live target folders derived and reproducible while
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

Target folders may already contain resources that do not come from configured
sources. A conforming tool MUST NOT silently delete those entries. It MUST
either preserve them or require an explicit cleanup choice before removal.

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

If a target declaration is removed from the selected manifest, core v1 projection no
longer has that target in its authorized write set and therefore does not clean
that folder during normal activation. To clean a target with only the base
projection contract, run cleanup while the target is still declared, then remove
the declaration. Higher-level tools MAY keep activation state and offer an
orphaned-target reconciliation workflow that previews removal, ignore, or
capture back to source.

## Overrides

A dot-prefixed folder directly inside the configured resources source is a
target-root override. A dot-prefixed folder directly inside a conventional
resource item under the configured resources source is an item-level target
override.
For target `./.claude`, the override folder is `.claude`; for target
`./runtime/agent`, the override folder is `.runtime`.

Projection MUST process the resources tree in this order:

1. Copy canonical resource files, excluding target-root override folders and
   item-level override folders.
2. Merge the matching target-root override folder, if present.
3. Merge the matching item-level target override folder, if present.
4. Strip the override folder segment from output paths.
5. Apply `.harnessIgnore` rules to every source file before it enters the
   projection.

Overrides are merged at the file level, not as whole-directory replacements.
Override files replace canonical files only when they project to the exact same
relative file path. Sibling canonical files continue to project as usual.
Override files MAY add new files. Nested dot-prefixed folders inside an
override, such as `.codex-plugin`, are ordinary output folders unless they are
the immediate target-root or item-level override folder.

### Override Conflicts

Projection MUST reject file/directory conflicts before writing. A conflict
exists when two source files project to paths where one path requires the other
path to be a directory.

Examples:

```text
# Conflict: canonical file, override directory.
# The canonical source says "hooks" is a file, but the override needs
# "hooks" to be a directory so it can contain config.json.
.harness/resources/skills/review/hooks
.harness/resources/skills/review/.claude/hooks/config.json

# Conflict: canonical directory, override file.
# The canonical source says "hooks" is a directory, but the override says
# "hooks" itself is a file.
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/.claude/hooks

# Allowed: exact file replacement
.harness/resources/skills/review/SKILL.md
.harness/resources/skills/review/.claude/SKILL.md

# Allowed: replace one nested file and keep the rest
.harness/resources/skills/review/hooks/config.json
.harness/resources/skills/review/hooks/notify.json
.harness/resources/skills/review/.claude/hooks/config.json
```

A tool MUST report a diagnostic for the conflicting source paths and MUST NOT
apply the projection until the conflict is resolved.

## Dir Source

The optional top-level `[dir]` table declares a single repo-local **dir
source** whose contents project to repo-relative paths. The dir source is
how a repository carries durable, per-file outputs that are not modeled as
resource items: top-level agent instructions (`AGENTS.md`, `CLAUDE.md`),
per-target configuration (`.claude/settings.json`), repo-root files
(`.gitignore`, `README.md`), and similar one-off artifacts.

```toml
[dir]
path = "./.harness/dir"
```

The `path` field is OPTIONAL and defaults to `./.harness/dir` when the
`[dir]` table is present. The `[dir]` table itself is OPTIONAL; if absent,
no dir composition or copy happens, even if `./.harness/dir` exists.

### Composable Leaves

A directory inside the dir source that contains the empty marker file
`.harnessComposable` is a **composable leaf**. Its name (relative to the
dir source root) is the output file path. Files inside it that match the
numeric-prefix pattern `<order>_<name>` are **parts**: their bytes
concatenate in `order` to produce the output file.

```text
.harness/dir/AGENTS.md/
  .harnessComposable           # marker (empty)
  100_intro.md                 # part, order 100
  200_rules.md                 # part, order 200

# Output: ./AGENTS.md = 100_intro.md + 200_rules.md
```

The order prefix is a non-negative integer. Two parts MAY share the same
order; ties break by source path. A composable leaf MAY also contain a
`.harnessRef` file with exactly one repo-relative path pointing at another
composable leaf; that leaf's expanded parts are imported before this leaf's
local parts and re-sorted by `order`. Cycles, missing `.harnessRef` targets,
`.harnessRef` targets that escape the dir source root, and absolute
`.harnessRef` targets MUST be reported as errors.

A composable leaf MUST NOT contain subdirectories. A non-part, non-`.harnessRef`
file inside a composable leaf MUST be reported as an invalid part error;
the author either renames the file to match `<order>_<name>` or removes
the `.harnessComposable` marker to switch to copy mode.

### Copy Folders And Individual Files

Any directory in the dir source that does NOT contain the
`.harnessComposable` marker is a **copy folder**. Its files and
subdirectories are projected with their relative paths preserved.
Individual files at any depth project as direct copies.

```text
.harness/dir/
  README.md                    # -> ./README.md
  .claude/
    settings.json              # -> ./.claude/settings.json
    hooks/
      post-tool-use.sh         # -> ./.claude/hooks/post-tool-use.sh
  notes/
    01_dev_intro.md            # -> ./notes/01_dev_intro.md
```

The `.harnessComposable` marker file itself MUST NOT appear in any output,
in either mode.

### Output Paths And Target Overlap

Dir outputs are repo-relative paths. They MUST resolve inside the repository
and MUST NOT write inside `./.harness`, the configured resources source, or the
configured dir source. A dir output path that falls **under** a declared
`[[targets]]` path (for example
`.claude/settings.json` when `./.claude` is a declared target) is merged
into that target's projection during activation, so target idempotence and
unmanaged-entry cleanup respect dir-owned files. A dir output that would
**replace or contain** a declared target root itself (for example a dir
output at `.claude` when `./.claude` is a declared target) MUST be
reported as `harness.dir_output_target_overlap`.

A dir output path that does not overlap any declared target writes
directly to that repo-relative path.

### Conflicts

If two dir outputs would project to the same repo-relative path
(composable leaf vs copy file, or copy file vs copy file via path/dir
collision), projection MUST report a `harness.dir_path_conflict` and MUST
NOT apply until the conflict is resolved.

If a dir output and a resource projection (canonical or per-resource
override) would land at the same path inside the same target, projection
MUST report a `harness.projection_path_conflict` and MUST NOT apply.

### Ignore Rules

Source-side `.harnessIgnore` rules apply to files inside the dir source the
same way they apply to resource files, using the source path (for example
`.harness/dir/AGENTS.md/200_skip.md` or
`resources/AGENTS.md/200_skip.md` when `[dir].path = "./resources"`).
Nested source-side rules therefore work inside `.harnessComposable` leaves
even when the dir source is outside `./.harness`.

Target-output `.harnessIgnore` rules also apply to dir outputs after the
candidate output path is known. Implementations MAY use a bootstrap pass to
compute candidate dir outputs, discover `.harnessIgnore` files in existing
output ancestor directories, and then recompute final outputs with those
rules. During dir collection only global ignore rules participate. The
`[mutable]` section applies only to target resource projections; dir outputs
are not mutable target files.

Active profile roots also participate in dir collection. Profile dir folders
overlay the configured dir source path, can add copy files or composable
parts, and can carry logical `.harnessIgnore` files that suppress base dir
files or base composable parts.

## `.harnessIgnore`

`.harnessIgnore` defines files that MUST be ignored when projecting resources
and dir outputs. The repo-root file is the repository-wide boundary; local
files may refine the boundary for a source subtree or an existing target
output subtree.

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/resources/skills/*/metadata.toml
!.harness/resources/skills/release-notes/metadata.toml

[*]
.harness/**/tmp/

[mutable]
.harness/**/settings.local.json

# Root rules may also match target output paths.
.agents/**/scratch.tmp
```

Patterns in the repo-root file are repo-relative and may match either source
paths or target output paths. Patterns in local files are interpreted
relative to the directory containing that `.harnessIgnore` file. Tools MUST
support blank lines, `#` comments, `!` negation, leading `/` anchors,
trailing `/` directory patterns, `*`, `**`, and `?`.

A rule has a kind (`ignore` or `mutable`). The kind decides whether the rule
excludes a file from projection or marks it as mutable in the target. Both
kinds share the same pattern grammar and the same precedence rule: the last
matching participating rule wins.

Ignore evaluation is ordered:

1. Start with `included` and `not mutable`.
2. Read rules from top to bottom.
3. For ignore rules, a matching non-negated rule changes state to `ignored`;
   a matching negated rule changes state back to `included`.
4. For mutable rules, a matching non-negated rule changes state to `mutable`;
   a matching negated rule changes state back to `not mutable`.
5. The last matching participating rule of each kind wins.

Section headers affect subsequent rules:

- `[*]` or `[global]` applies subsequent ignore rules to every target.
- `[mutable]` applies subsequent mutable rules to every target.
- `[ignore]` switches subsequent rules back to ignore rules.
- Target-specific headers such as `[.claude]`, `[!.cursor]`, and
  `[mutable .claude]` are unsupported. Tools MUST report
  `harness.ignore_unsupported_scope` and MUST NOT apply rules below that
  unsupported header until another supported section header appears.

Mutable files MUST still flow through the projection ignore step. If a file is
both ignored and marked mutable, the ignore decision wins because the file
never enters the projection in the first place.

A trailing `/` pattern is directory-only. It matches the directory itself only
when the candidate is a directory, and it matches descendants of that directory.

### Local `.harnessIgnore` Files

Additional `.harnessIgnore` files MAY appear inside source locations and
inside existing target-output locations. They let a resource author or
consumer keep ignore rules next to the files they apply to, without
bloating the repo-root file.

```text
.harnessIgnore                                  # root file
.harness/resources/skills/review/.harnessIgnore           # source-local resource rules
.harness/resources/skills/review/.claude/.harnessIgnore   # source-local override rules
resources/AGENTS.md/.harnessIgnore              # source-local custom dir rules
.agents/skills/review/.harnessIgnore            # target-output-local rules
notes/.harnessIgnore                            # target-output rules for dir outputs
```

The following rules apply:

- **Source-local rules.** A `.harnessIgnore` file under `./.harness`, under
  the configured resources source, or under the configured `[dir]` source root
  matches source paths. A pattern like `*.tmp` in the default-path file
  `.harness/resources/skills/review/.harnessIgnore` matches
  `.harness/resources/skills/review/scratch.tmp` and
  `.harness/resources/skills/review/nested/scratch.tmp` but does NOT match
  `.harness/resources/skills/triage/scratch.tmp`.
- **Target-output-local rules.** A `.harnessIgnore` file under an existing
  declared target root matches target output paths. A pattern like `*.tmp`
  in `.agents/skills/review/.harnessIgnore` matches an output path such as
  `.agents/skills/review/scratch.tmp`, regardless of whether the source was
  `.harness/resources/skills/review/scratch.tmp` or an override file. For
  dir outputs, implementations also discover `.harnessIgnore` files in
  existing ancestor directories of candidate output paths, such as
  `notes/.harnessIgnore` for an output `notes/release.md`.
- **Scope of effect.** A local file participates only when the candidate
  source path or target output path is inside that file's directory.
- **Evaluation order.** Rule sets are evaluated in phases: the repo-root file
  first, then source-local and profile-local files in order of increasing
  directory depth, then target-output-local files in order of increasing
  directory depth. Within each rule set, rules are read top-to-bottom. The
  last-matching participating rule across all files wins. A deeper source or
  target file can therefore re-include a path that a shallower file in the
  same phase excluded, or exclude a path that a shallower file would have
  included. Target-output-local rules form the final output boundary for a
  target subtree and cannot be undone by profile-local source rules.
- **Same grammar.** Nested files support the same comments, negation,
  anchors, glob syntax, and supported section headers (`[*]`, `[global]`,
  `[ignore]`, and `[mutable]`) as the repo-root file.
- **Target-specific placement.** A nested `.harnessIgnore` inside a target
  output subtree is the target-specific mechanism. Target-specific section
  headers are invalid even inside override folders.
- **Synthetic ignore.** Every `.harnessIgnore`, `.harnessProfile`, and
  `.harnessProfileRoot` file is itself excluded from projection, equivalent
  to global declaration-file ignore rules. Implementations MUST NOT copy
  those declaration files into targets, even when no explicit rule excludes
  them.
- **Target-output protection.** A `.harnessIgnore` file that already exists
  in a target-output location MUST NOT be overwritten by projection and MUST
  NOT be removed by unmanaged cleanup. Ancestor directories required to keep
  that file in place MUST also be preserved. Existing target-output
  `.harnessProfile` files have the same protection.

Local files are optional scoped boundary inputs; a repository that uses only
the repo-root file remains conforming. Target-output-local files participate
only after they exist on disk; implementations are not required to infer the
contents of a file that has not been created yet.

## Profile Overrides

Profile overrides are optional source overlays selected by `.harnessProfile`
files. A `.harnessProfile` file is UTF-8 text. After trimming whitespace from
each line and ignoring blank lines, it SHOULD contain zero or one profile
name. Zero profile names selects no profile for that output subtree. More
than one non-empty line SHOULD produce a warning, and tools MAY use the first
profile name for compatibility. The repo-root `.harnessProfile` applies
globally; a target/output-local `.harnessProfile` applies to its directory
and descendants, and the nearest selector wins for any output path.

Profile content is declared with `.harnessProfileRoot`, which MUST live under
`./.harness`, under the configured resources source, or under the configured
`[dir]` source root. A `.harnessProfileRoot` file is UTF-8 text. After
trimming whitespace from each line and ignoring blank lines, it MUST contain
exactly one profile name. Zero profile names or more than one non-empty line
MUST produce an error, and that profile root MUST NOT participate in
projection. A `.harnessProfileRoot` MUST NOT be nested inside another profile
root. The directory containing `.harnessProfileRoot` is a profile root. It is
source storage, not a resource item, and MUST NOT be projected as a skill,
rule, plugin, dir output, or copied declaration file.

Profile roots overlay source paths by where the marker is placed:

- If the marker directory is an immediate child of the configured resources
  source or the configured `[dir]` source root, that marker directory overlays
  that source root. For example, under the default resources path,
  `.harness/resources/deploy/.harnessProfileRoot` overlays
  `.harness/resources`; children of `deploy/` become logical resource
  outputs.
- If the marker directory is nested deeper inside the configured resources
  source or the configured `[dir]` source root, that marker directory overlays
  its parent directory. This lets resource items carry portable local
  profiles. For example, under the default resources path,
  `.harness/resources/skills/example/aggressiveProfile/.harnessProfileRoot`
  overlays `.harness/resources/skills/example`, so
  `.harness/resources/skills/example/aggressiveProfile/SKILL.md` replaces
  the logical `.harness/resources/skills/example/SKILL.md` when that profile
  is active.
- Otherwise, a marker directory under `./.harness` overlays `./.harness`.
  This supports kit layouts such as
  `.harness/kits/deploy-kit/.harnessProfileRoot` with children like
  `resources/` and `dir/`.

During projection, generic base source files are considered first, then
generic active profile files, then target-derived override files, then active
profile files inside the matching target override. A generic profile overlay
therefore cannot replace a target-specific override such as `.codex`; a
profile-specific `.codex` override can. If multiple active profile roots
project the same logical file, a tool SHOULD warn and MAY use deterministic
last-wins ordering. Profile-local `.harnessIgnore` files match the logical
overlay path, not the storage path.
For example, an ignore file at
`.harness/profiles/personal/dir/AGENTS.md/.harnessIgnore` applies as if it
were located at `.harness/dir/AGENTS.md/.harnessIgnore`, so it can suppress
base composable parts before adding profile parts.

Source-local `.harnessIgnore` files that are physical ancestors of a profile
root also apply before the profile root is mapped onto its logical overlay
path. For example, `.harness/kits/.harnessIgnore` can exclude
`.harness/kits/deploy/**/.harnex/` metadata from the active `deploy` profile
even when files under that profile root overlay logical paths such as
`.harness/resources` or `.harness/dir`.

For `[dir]`, implementations MUST use a bootstrap/final flow: collect
candidate outputs with source-side rules and any known profile selectors,
discover target-output `.harnessIgnore` and `.harnessProfile` files in
candidate output ancestors, then recompute final outputs. Active profile
directories MUST also participate in candidate discovery, so a target-output
`.harnessProfile` can activate a profile-only dir output even when no base
dir source would have produced that output. Active profile directories may
contribute to an existing `.harnessComposable` leaf even when the profile
directory does not repeat the `.harnessComposable` marker.

## Reviewability

The source/projection boundary makes cross-harness differences reviewable:

- A diff under the configured resources source affects every target that
  projects that resource path.
- A diff under `.agents`, `.claude`, `.cursor`, or another override folder
  inside a resource item affects only targets that use that override.
- A diff in the repo-root `.harnessIgnore` changes projection boundaries
  globally; a diff in a nested `.harnessIgnore` changes projection only
  inside that file's source or target-output directory.
- A diff in an existing target-output `.harnessIgnore` changes what will be
  copied into that output subtree, without making the target folder a source
  of truth.
- A diff in `.harnessProfile` changes which profile root overlays apply to
  that output subtree; a diff under an active `.harnessProfileRoot` changes
  only outputs where that profile is selected.
- A diff in the selected manifest changes resource source paths, target paths,
  dir settings, and extension declarations.

## Safety Requirements

- Validation MUST be read-only.
- Paths MUST stay inside the repository.
- Initialization commands MUST explain planned filesystem changes before mutation.
- Activation commands SHOULD offer a dry run and explain creates, updates,
  removals, keeps, unmanaged preserved entries, and mutable skips before
  mutation.
- Live target folders MUST be treated as projection targets, not source
  repositories.
- Activation MUST be idempotent for the same selected manifest, configured
  source roots, `.harnessIgnore`, participating resources, cleanup policy, and
  mutable policy.
- Projection MUST honor `.harnessIgnore` so logs, metadata, caches, and
  implementation state stay out of runtime folders.
- Tools MUST merge target-derived overrides when present and fall back to the
  canonical files when no override exists.
- Unknown resource kinds MAY be used as directories under the configured
  resources source.
- Mutable files MUST be created on first projection and MUST be skipped on
  subsequent projections unless the user explicitly opts in to force a
  re-projection.

## Security Considerations

Harness config describes a system that copies files from version control into
folders that an AI agent or other tool will subsequently read. The integrity
of those copies has a direct effect on what the agent does. Implementations
SHOULD consider the following threats explicitly:

- **Path traversal.** Manifest paths, target paths, and ignore patterns are
  user-controlled. Implementations MUST refuse paths that resolve outside
  the repository after normalization (see [Encoding, Paths, and Case
  Sensitivity](#encoding-paths-and-case-sensitivity)).
- **Symlink redirection.** Symlinks in the source tree or in declared target
  trees can redirect writes outside the repository. v1 implementations SHOULD
  treat such symlinks as diagnostics rather than silently following them.
- **TOCTOU on apply.** A target may be modified between planning and
  applying. Implementations SHOULD re-check the existence and managed/
  unmanaged classification of files at apply time, not only at plan time.
- **Unmanaged-entry deletion.** Cleanup deletes user files. The default
  policy MUST be preserve, and any deletion MUST be visible in the plan
  before it happens.
- **Mutable bypass.** `[mutable]` rules are an explicit "the runtime owns
  this" declaration. Implementations MUST NOT overwrite a mutable target
  without an explicit, user-visible force decision.
- **Untrusted overrides.** A repository may import resource items from
  third parties. Because override folders can rewrite arbitrary target
  files, implementations and downstream products SHOULD provide tooling to
  diff override folders against canonical files and to scope the targets a
  given override may affect.
- **Activation that reads its output.** Live target folders MUST NOT be
  used as inputs to the next projection. Treating a target as both source
  and sink can amplify runtime edits into source-of-truth changes silently.

The standard does not prescribe authentication, signing, or supply-chain
verification for resource folders. Those are appropriate concerns for
product layers and organizational policy.

## Compatibility and Future Evolution

Within v1, the following kinds of change are permitted and do not require a
new standard version:

- Editorial clarifications that do not change normative meaning.
- New optional fields with defined defaults that preserve the meaning of
  v1 documents that omit them.
- New extension declarations (which are opt-in by definition).
- Additional diagnostics or non-blocking warnings.

The following changes are reserved for v2:

- Any change to the manifest schema for targets or the top-level `version`
  field that would invalidate a v1 manifest.
- Any change to projection semantics (`create`, `update`, `remove`,
  `keep`, `preserve`, `mutable`) that would alter the on-disk outcome of
  an unchanged v1 input.
- Any change to `.harnessIgnore` grammar or precedence that would alter
  which files an existing v1 ruleset includes, excludes, or marks
  mutable.
- Reservation of resource kinds or target names previously available to
  user repositories.

Implementations SHOULD treat manifests whose `version` is a positive
integer greater than the maximum they support as an "unsupported version"
diagnostic, not as a malformed manifest. This lets unsupported future manifests fail
informatively against older tools.
