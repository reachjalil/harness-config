---
title: Standard
seoTitle: .harness Config Standard
socialTitle: The .harness repository configuration standard
description: Normative definitions for the .harness source layout, activation projection, runtime-owned mutable files, target-derived overrides, .harnessIgnore and .harnessMutable precedence, profile overlays, and conformance boundaries.
socialDescription: Normative definitions for source resources, runtime-owned mutable files, targets, overrides, ignores, mutable declarations, profile overlays, extensions, and activation behavior.
canonicalPath: /specifications/v1/standard/
slug: standard
order: 2
locale: en
sectionCode: "02"
summary: Normative definitions for terms, repository shape, TOML, projection, runtime-owned mutable files, overrides, ignores, mutable declarations, profiles, extensions, and conformance.
llmSummary: Defines the .harness repository shape, TOML contract, activation projection, runtime-owned mutable files, target-derived overrides, ignore and mutable precedence, profile overlays, extension declarations, and conformance boundaries.
audience: Tool authors, standard reviewers, and technical implementers.
contentKind: spec
status: draft
updated: 2026-05-28
---

# Harness config standard

**Status:** Version 1 specification proposal. The file shape, manifest schema,
projection contract, and ignore grammar described here are intended to be
implementable without consulting the reference code, but the public contract is
still in proposal review. Until public releases, conformance fixtures, adopter
repositories, and external feedback mature, treat the TypeScript packages as an
alpha reference implementation. Once v1 is accepted, changes that would
invalidate a v1 repository or v1 implementation are reserved for v2.

Harness config is a repository-local standard for declaring durable agent
*harness resources* (the prompts, skills, rules, plugins, and similar files
that condition an AI coding agent's behavior) and projecting them into
harness surfaces in a reviewable, reproducible way.

The standard separates three ownership categories: canonical repo-owned
source, generated harness surface outputs, and runtime-owned mutable target
files. A mutable file is still declared from source and may be seeded by
projection, but after first activation the live target bytes belong to the
runtime until an explicit force decision re-projects the source template.

A repository keeps neutral source roots and projects them into declared target
folders. The default manifest is `./.harness/harness.toml`; tools MAY also use another
repo-local TOML file when that path is explicitly selected. Durable resources
live under ordered `[[resources]]` source roots. Repo-relative one-off outputs
live under ordered `[[dir]]` source roots. The `./.harness` directory is
therefore a convention for source storage, not the required location of the
manifest. Projection is filtered through `.harnessIgnore` rule files, while
seed-only runtime-owned files are declared separately in `.harnessMutable`
rule files. The repo-root `./.harnessIgnore` sets repository-wide exclusion
boundaries, and the repo-root `./.harnessMutable` sets repository-wide mutable
seed boundaries. Local files may sit beside source subtrees. Target-output
`.harnessIgnore` files may sit in live output subtrees as local output
filters. Every target-output folder that receives a projection is explicit;
there are no implicit targets and no reserved target folder names.

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

- **Harness** — the AI agent or developer-facing tool runtime that consumes
  repository instructions, context, tools, and configuration to operate on a
  project.
- **Harness surface** — the repository-local files and folders a harness reads,
  such as `AGENTS.md`, `.agents`, `.claude`, `.cursor`, or another declared
  target output.
- **Convention root** — the directory `./.harness` at the root of a
  repository, commonly used for resources, dir source files, profiles, and
  other source storage. It is not the required manifest location.
- **Manifest** — the selected repo-local TOML file, defaulting to
  `./.harness/harness.toml`, which declares the standard version, ordered
  resources sources, ordered dir sources, targets, and extensions.
- **Resources source** — a repo-local directory declared by a `[[resources]]`
  `path`, whose files, folders, and resource composable leaves are projected
  into every declared target. Multiple resources sources are layered in
  manifest order.
- **Resource kind** — a category of source material such as
  `skills`, `rules`, `hooks`, or `plugins` under a resources source.
  Kinds are directory names, not reserved schema concepts.
- **Resource item** — commonly one folder under
  `<resources>/<kind>/<name>`, such as
  `./.harness/resources/skills/review`. Item folders are conventional units
  of review, but a resources source may also contain direct files such as
  `./.harness/resources/hooks.json`.
- **Target** — a repository-local directory declared in the selected manifest
  that receives projections of configured resources sources.
- **Override folder** — an immediate dot-prefixed subfolder inside a resource
  item (for example `.claude/` inside
  `./.harness/resources/skills/review/`) or directly inside
  `./.harness/resources` whose files replace or add to canonical files when
  projecting to the matching target.
- **Dir source** — a repo-local directory declared by a `[[dir]]` `path`.
  Its contents project to repo-relative output paths, either by composition
  (a directory marked with `.harnessComposable` whose numbered parts
  concatenate into one output file) or by direct copy (any other directory or
  file under a dir source copies to the matching repo-relative path).
  Multiple dir sources are layered in manifest order.
- **Composable marker** — the empty file `.harnessComposable` placed inside
  a directory under a resources source or a dir source to mark it as a
  composable leaf. Under resources, the leaf composes one projected resource
  file inside each target. Under dir sources, the leaf composes one
  repo-relative output file. Without the marker, resource directories remain normal
  resource folders and dir directories are treated as copy folders.
- **Projection** — the computed mapping from `(source root, manifest,
  configured sources, overrides, ignore rules, mutable rules)` to a per-target
  file tree.
- **Activation** — the act of materializing a projection into one or more
  target folders on disk.
- **Mutable file** — a projected target file declared by `.harnessMutable`;
  source provides the initial template, and the runtime owns the target bytes
  after first projection.
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
- the selected TOML manifest schema for targets with required repo-local paths,
  ordered `[[resources]]` source roots, ordered `[[dir]]` source roots, and
  top-level extension declarations,
- the configured resources source trees,
- target-derived override folders,
- copy projection (idempotent under fixed inputs),
- dir composition (`.harnessComposable` leaves) and copy contract
  for files that project to repo-relative paths,
- `.harnessIgnore` projection ignore files, including repo-root rules,
  source-local rules, profile-local rules, and target-output-local rules.
- `.harnessMutable` projection mutable files, including repo-root rules,
  source-local rules, and profile-local rules.

Within v1, this document MAY receive editorial clarifications and
backward-compatible normative refinements (for example, optional fields with
defined defaults). Changes that would invalidate a v1 repository or v1
implementation are reserved for v2.

## Scope

Harness config standardizes:

- the selected manifest file and its schema,
- the resource layout under configured resources sources,
- per-resource target overrides as immediate dot-prefixed folders,
- explicit target declarations with required repo-local paths,
- top-level activation policy with defined defaults,
- ordered dir source roots, with composable (`.harnessComposable`)
  leaves and copy-mode directories that project to repo-relative paths,
- top-level extension declarations (discovery and activation policy only),
- copy projection from configured resources sources to declared targets,
- `.harnessIgnore` as the projection exclusion filter, including
  target-output exclusions.
- `.harnessMutable` as the projection mutable-file filter.

Declared targets are live harness surfaces, not source repositories. A
repository MAY commit generated target outputs, gitignore them, or mix committed
managed files with local controls, as long as the reviewed source of truth stays
in the selected manifest and configured source roots. This lets teams
experiment in `.agents`, `.claude`, `.cursor`, or another surface without
promoting runtime edits back into the canonical source layout.

When a repository gitignores generated target outputs, it SHOULD keep tracked
activation instructions, such as a root instruction note, README setup step, or
script, so a fresh checkout can validate and regenerate those outputs. Shared
configured source roots that make the targets reproducible SHOULD stay tracked;
private or experimental local roots such as `.harness/local/` MAY be
gitignored when the repository intentionally treats them as developer-local
overlays.

The `.harnessMutable` model is the file-level version of that boundary. It
lets a repository publish an initial, reviewable template for target-local
settings or state while keeping subsequent runtime edits out of the canonical
source tree.

### Out of Scope

Harness config does **not** standardize:

- product workflows, command surfaces, or end-user UX,
- hosted services, registries, or marketplaces,
- distribution, dependency resolution, or package management for resources,
- harness runtime behavior or how harnesses consume target files,
- skill, prompt, or rule schemas beyond "folder with files",
- selection, grouping, sessions, presets, or kits,
- target-to-source capture or reverse projection,
- target edit review workflows (see [Mutable Files](#mutable-files) for the
  base contract),
- remote sync, telemetry, or audit logging.

Harness config is a local file contract. The standard does not require
telemetry, analytics, machine identifiers, remote error reporting, hosted
services, or network access to validate, plan, or activate a repository.

These concerns belong in tools, products, or organizational policies that
build on top of the standard. Keeping them out of v1 is what lets multiple
implementations interoperate on the same configured source trees.

## Resource Shape

Each resources source is a repo-local directory selected by a `[[resources]]`
entry in the manifest. Resources sources are ordered; later sources override
earlier sources at the exact same logical projected file path. A missing
resources source is a valid empty layer. Resource kinds such as `skills`,
`rules`, `hooks`, and `plugins` are ordinary directories below each source.
Direct files are allowed, so a repository can carry target-root configuration
such as `hooks.json` without inventing a resource item folder.

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
kinds MAY exist under any resources source without per-kind manifest
declaration.

Any directory under a resources source MAY be a composable file source
when it contains an empty `.harnessComposable` marker. The directory name is
the projected file path, and its numeric-prefix parts compose with the same
`.harnessRef` and `.harnessIgnore` semantics defined for dir composable
leaves. A `.harnessMutable` rule that matches the composable leaf's logical
output path marks the composed output file as runtime-owned; the marker,
parts, and `.harnessRef` file are never projected individually. For example,
`./.harness/resources/skills/review/SKILL.md/.harnessComposable` projects one
target file at `skills/review/SKILL.md`; the numbered files inside that
directory are not projected individually. Resource composable leaves are still
resources: they project inside declared target folders and participate in
resource overrides, profiles, and resource ignore rules.

An immediate dot-prefixed directory directly under a resources source is a
target-root override. For target `./.gemini`, files under the conventional
`./.harness/resources/.gemini/` overlay that resources source and the
`.gemini` segment is stripped from the output path. This is how
target-specific root files such as `.gemini/hooks.json` are represented.

An immediate dot-prefixed directory inside a conventional resource item, such
as `./.harness/resources/skills/code-review/.claude/` under a conventional
resources source, is an item-level target override. Its files overlay that
item and the override segment is stripped from the output path.

## Manifest

```toml
version = 1

[activation]
targetSymlinks = "conflict"

[[resources]]
path = "./.harness/resources"

[[resources]]
path = "./.harness/local/resources"

[[targets]]
path = "./.claude"

[[targets]]
path = "./runtime/agent"

[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"

[extensions.example]
version = 1
activation = "explicit"
```

### Resources

Resource projection uses only declared `[[resources]]` source roots. If no
`[[resources]]` entries are declared, resource projection is disabled.

Each `[[resources]]` entry MUST contain `path`. Tools MUST NOT fail validation
solely because a `[[resources]]` entry carries an unrecognized key reserved for
future v1 revisions; they SHOULD report unrecognized keys as informational.
The path MUST be repo-local, MUST resolve inside the repository, and MUST NOT
contain `..` segments. A manifest MUST NOT contain a single `[resources]` table or any
`[resources.<kind>]` tables; resource kinds remain source-tree names, not
manifest schema entries.

Top-level resource directory names SHOULD use lowercase letters, numbers,
underscores, or dashes. Dot-prefixed names directly under
a resources source are target-root overrides, not shared canonical output
folders. Resource files and directories MUST NOT rely on path traversal; all
projected output paths MUST remain inside their declared target.

### Targets

Every target is explicit. Harness config does not reserve, prefer, or imply any
runtime target folder name. Each `[[targets]]` entry in the selected manifest
declares one repo-local target path and MUST contain `path`. Tools MUST NOT
fail validation solely because a `[[targets]]` entry carries an unrecognized
key reserved for future v1 revisions; they SHOULD report unrecognized keys as
informational.

Target paths MUST resolve inside the repository, MUST point at a folder below
the repository root, MUST NOT contain `..` segments after normalization, MUST
NOT point at `./.harness` itself or any descendant of it, and MUST NOT overlap
configured source roots such as `[[resources]]` or `[[dir]]`.

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

Two `[[targets]]` entries whose normalized paths overlap as ancestor and
descendant paths, such as `./.agents` and `./.agents/skills`, MUST be rejected
with a diagnostic. Targets must be independent projection roots.

Targets that share a first path segment intentionally share one v1
target-derived override namespace. For example, `./runtime/agent` and
`./runtime/tools` both use `.runtime` overrides. Prefer distinct first segments
when two targets need distinct override namespaces.

Targets are configuration, not hidden mutation. Tools SHOULD show the target
plan before creating, replacing, copying, or removing files.

### Activation Policy

The optional top-level `[activation]` table contains standard activation
policy. When omitted, all fields use their defaults. Tools MUST NOT fail
validation solely because `[activation]` carries an unrecognized key reserved
for future v1 revisions; they SHOULD report unrecognized keys as
informational.

`targetSymlinks` controls symlinks in declared target trees that occupy a path
required by projection:

- `"conflict"` (default): report a diagnostic and do not apply until the
  symlink is removed manually or a replacement policy is selected.
- `"replace"`: activation MAY remove the link itself and materialize the
  projected copy output at that path.

In both modes, implementations MUST NOT follow target symlinks while
discovering, planning, or applying projection.

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

A tool that encounters an unrecognized top-level table or key under a supported
`version` MUST NOT fail validation solely because of it, and SHOULD report it
as informational so authors can decide whether newer tooling is needed. This
does not change the manifest rules that make singular `[resources]`,
`[resources.<kind>]`, and `[dir]` tables invalid in v1.

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
  `./.harness`, or a declared target tree is treated as a leaf filesystem
  entry. v1 implementations MUST NOT follow symlinks while discovering source
  trees, existing target trees, ignores, profiles, or dir outputs. When a
  target symlink occupies a path activation needs to write, activation MUST
  report a conflict unless an explicit target symlink replacement policy is
  selected. With that policy, the link itself MAY be replaced according to the
  same file/path conflict rules used for other non-directory entries. v1 does
  not require preserving symlinks as links or projecting source symlinks into
  targets.
- **Hidden files.** Names beginning with `.` are not implicitly ignored.
  They participate in projection like any other file unless excluded by
  `.harnessIgnore`. This does not make Harness config declaration files target
  payloads: `.harnessIgnore`, `.harnessMutable`, `.harnessProfile`, and
  `.harnessProfileRoot` are boundary controls and MUST NOT be projected into
  targets.

## Routing Resources To Targets

Targets receive the configured resources source trees. A resource kind, direct
file, or subtree is excluded from one target with a
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
- configured resources sources carry the target resource tree.
- `.harnessIgnore` filters source files and target output subtrees.
- `.harnessMutable` marks source files that should seed target files once and
  then become runtime-owned.

Tools SHOULD NOT introduce per-target resource mappings in the selected
manifest for v1. Keeping target declarations limited to required repo-local
paths plus ignored future-compatible fields, while source roots stay ordered at
the top level, preserves one place for projection filtering and makes dry-run
output easier to reason about.

## Copy Projection

Activation is a repeatable copy projection from source inputs to declared
targets. The inputs are:

1. the participating files, composable leaves, and folders under
   configured resources sources, including their override folders,
2. the selected versioned manifest,
3. `.harnessProfile` selectors and active `.harnessProfileRoot` overlays,
4. all participating `.harnessIgnore` files, including repo-root,
   source-local, profile-local, and target-output-local rules,
5. all participating `.harnessMutable` files, including repo-root,
   source-local, and profile-local rules,
6. the cleanup policy (preserve unmanaged entries vs. remove them),
7. the mutable policy (skip mutable files vs. force re-projection),
8. the target symlink policy (conflict vs. replace).

**Idempotence (testable property).** Let `M_n` be the managed projection subset
of a declared target after the `n`-th activation against the unchanged inputs
defined above and unchanged target state except for mutable-file byte changes.
For every `n ≥ 2`:

- the set of files in `M_n` MUST equal the set in `M_1`,
- every managed (non-mutable) file in `M_n` MUST be byte-identical to its
  counterpart in `M_1`,
- every mutable file present in `M_1` MUST remain present in `M_n` with the
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
- `mutable`: a file declared mutable in `.harnessMutable` already exists in the
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
`.harnessMutable`. Projection materializes them on first activation (action
`create`) and reports them as `mutable` on every subsequent activation,
whether or not target bytes still match the source. Tools SHOULD offer an
explicit force decision that re-projects source bytes when the team needs to
reset runtime-owned state.

Mutable is an ownership declaration, not a synonym for ignore. Ignored files do
not enter the projection. Mutable files do enter the projection when missing,
so the source tree can provide an initial shape and reviewable intent. Once the
target file exists, the runtime owns its bytes and activation MUST NOT
overwrite it unless the mutable policy explicitly forces re-projection.

During migration, a mutable file that should exist for fresh users SHOULD be
copied into a configured source root before its path is added to
`.harnessMutable`. Declaring a target file mutable without a source seed only
protects an existing local file; it does not give new checkouts an initial
version.

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

### Filesystem Semantics Summary

These rules are normative for v1 activation:

- Symlinks are never followed while discovering source roots, target trees,
  ignore files, profile selectors, or dir outputs. A symlink is a leaf
  filesystem entry.
- When a target symlink occupies a path activation needs to write, activation
  MUST report a conflict unless the selected target symlink policy explicitly
  permits replacing the link itself.
- Managed target files are overwritten from the current source projection when
  their bytes differ.
- Mutable target files are created from source once and then become
  runtime-owned until an explicit force decision re-projects them.
- Unmanaged target entries are preserved unless explicit cleanup is selected.
- Target-output `.harnessIgnore` and `.harnessProfile` files are protected
  local state and MUST NOT be projected over or removed by unmanaged cleanup.
- Activation is deterministic for the inputs defined in
  [Copy Projection](#copy-projection).
- Targets MUST NOT point at `./.harness`, overlap configured source roots, or
  overlap each other.

For example, `.harness/resources/hooks.json` may update `.agents/hooks.json`
when source bytes change, while `.agents/skills/review/settings.local.json`
matched by `.harnessMutable` is seeded once and then left untouched as
runtime-owned state. A target-output file such as
`.claude/skills/review/.harnessIgnore` can filter that `.claude` subtree and
remains local target state.

## Overrides

A dot-prefixed folder directly inside a configured resources source is a
target-root override. A dot-prefixed folder directly inside a conventional
resource item under a configured resources source is an item-level target
override.
For target `./.claude`, the override folder is `.claude`; for target
`./runtime/agent`, the override folder is `.runtime`.

Projection MUST process resource files in this ascending precedence order,
where later matching files replace earlier files at the exact same projected
path:

1. Canonical base resource files across `[[resources]]` sources in manifest
   order, excluding target-root override folders and item-level override
   folders.
2. Generic active-profile overlay files.
3. Target-derived override files across `[[resources]]` sources in manifest
   order, including matching target-root override folders and matching
   item-level override folders. The override folder segment is stripped from
   output paths.
4. Profile-specific target override files inside active profile roots.

Ignore rules apply to every source file before it enters projection and remain
an orthogonal final filter.

When two files in the same precedence phase project to the exact same output
path, later configured resources sources win over earlier sources. Within one
resources source and phase, lexicographic source path order provides the
deterministic last-wins tie-break. File/directory shape conflicts remain
errors, as described below.

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

Each top-level `[[dir]]` table declares one repo-local **dir source** whose
contents project to repo-relative paths. Unlike resources sources, dir sources
are not copied as resource trees into every target. They carry durable,
per-file outputs that are not modeled as resource items: top-level agent
instructions (`AGENTS.md`, `CLAUDE.md`), per-target configuration
(`.claude/settings.json`), repo-root files (`.gitignore`, `README.md`), and
similar one-off artifacts. Dir sources are ordered; later sources replace
earlier copy outputs at the exact same repo-relative path, and composable
leaves at the same logical path merge parts.

```toml
[[dir]]
path = "./.harness/dir"

[[dir]]
path = "./.harness/local/dir"
```

Each `[[dir]]` entry MUST contain `path`. Tools MUST NOT fail validation solely
because a `[[dir]]` entry carries an unrecognized key reserved for future v1
revisions; they SHOULD report unrecognized keys as informational. A manifest
MUST NOT contain a single `[dir]` table. If no `[[dir]]` entries are declared,
no dir composition or copy happens. A missing dir source is a valid empty
layer.

### Composable Leaves

A directory inside a dir source that contains the empty marker file
`.harnessComposable` is a **dir composable leaf**. Its name (relative to the
dir source root) is the repo-relative output file path. Files inside it that
match the numeric-prefix pattern `<order>_<name>` are **parts**: their bytes
concatenate in `order` to produce the output file. The same marker can also
exist under a resources source, but there it composes a projected resource
file rather than a repo-relative dir output.

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

Any directory in a dir source that does NOT contain the
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
and MUST NOT write inside `./.harness`, any configured resources source, or any
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

If two dir outputs would project to incompatible repo-relative paths where one
path requires another path to be both a file and a directory, projection MUST
report a `harness.dir_path_conflict` and MUST NOT apply until the conflict is
resolved. Exact file path replacement across ordered dir roots is allowed, and
same-path composable leaves merge parts.

If a dir output and a resource projection (canonical or per-resource
override) would land at the same path inside the same target, projection
MUST report a `harness.projection_path_conflict` and MUST NOT apply.

### Ignore Rules

Source-side `.harnessIgnore` rules apply to files inside each dir source the
same way they apply to resource files, using the source path (for example
`.harness/dir/AGENTS.md/200_skip.md` or
`resources/AGENTS.md/200_skip.md` when a `[[dir]]` path is `"./resources"`).
Nested source-side rules therefore work inside `.harnessComposable` leaves
even when the dir source is outside `./.harness`.

Target-output `.harnessIgnore` rules also apply to dir outputs after the
candidate output path is known. Implementations MAY use a bootstrap pass to
compute candidate dir outputs, discover `.harnessIgnore` files in existing
output ancestor directories, and then recompute final outputs with those
rules. During dir collection only global ignore rules participate.
`.harnessMutable` applies only to target resource projections; dir outputs are
not mutable target files.

Active profile roots also participate in dir collection. Profile dir folders
overlay the matching configured dir source path, can add copy files or
composable parts, and can carry logical `.harnessIgnore` files that suppress
base dir files or base composable parts.

## `.harnessIgnore`

`.harnessIgnore` defines files that MUST be ignored when projecting resources
and dir outputs. The repo-root file is the repository-wide boundary; local
files may refine the boundary for a source subtree or an existing target
output subtree. Ignore means excluded from projection entirely.

```text
# .harnessIgnore
.harness/**/logs/
.harness/**/*.log
.harness/resources/skills/*/metadata.toml
!.harness/resources/skills/release-notes/metadata.toml

[*]
.harness/**/tmp/

# Root rules may also match target output paths.
.agents/**/scratch.tmp
```

Patterns in the repo-root file are repo-relative and may match either source
paths or target output paths. Patterns in local files are interpreted
relative to the directory containing that `.harnessIgnore` file. Tools MUST
support blank lines, `#` comments, `!` negation, leading `/` anchors,
trailing `/` directory patterns, `*`, `**`, and `?`.

Ignore evaluation is ordered:

1. Start with `included`.
2. Read rules from top to bottom.
3. A matching non-negated rule changes state to `ignored`; a matching negated
   rule changes state back to `included`.
4. The last matching participating rule wins.

Section headers affect subsequent rules:

- `[*]` or `[global]` applies subsequent ignore rules to every target.
- `[ignore]` switches subsequent rules back to ignore rules.
- `[mutable]` is unsupported in `.harnessIgnore`. Tools MUST report
  `harness.ignore_mutable_section_unsupported` and MUST NOT treat rules below
  that header as mutable declarations. Mutable declarations belong in
  `.harnessMutable`.
- Target-specific headers such as `[.claude]`, `[!.cursor]`, and
  `[mutable .claude]` are unsupported. Tools MUST report
  `harness.ignore_unsupported_scope` and MUST NOT apply rules below that
  unsupported header until another supported section header appears.

A trailing `/` pattern is directory-only. For non-negated ignore rules, it
matches the directory itself and descendants of that directory. For negated
rules, it re-includes only the directory entry itself; descendants still need
their own negated rule such as `!path/to/item/**`. This preserves the
gitignore-style pattern where broad ignores can close a subtree while deeper
logical rules selectively reopen one child.

## `.harnessMutable`

`.harnessMutable` defines source files that are projected only as initial
seeds. Mutable is different from ignore: ignored files stay out of the
projection, while mutable files enter the projection when the target file is
missing. Once the target file exists, activation reports it as `mutable` and
MUST NOT overwrite its bytes unless the mutable policy explicitly forces
re-projection.

```text
# .harnessMutable
.harness/**/settings.local.json
.harness/resources/skills/*/permissions.json
```

Patterns use the same syntax, locality, negation, anchors, directory-only
suffix, and last-match-wins precedence as `.harnessIgnore`. The repo-root file
is repo-relative and matches source paths. Source-local and profile-local files
are interpreted relative to their logical source directory. Target-output
`.harnessMutable` files are not part of v1; mutable declarations belong to
source, not to live targets.

A `.harnessMutable` rule that matches a resource composable leaf's logical
output path marks the composed output file as mutable. The source parts still
compose the initial seed, and the marker, part files, and `.harnessRef` file
remain declaration inputs rather than projected payload.

Mutable evaluation is ordered independently from ignore evaluation:

1. Start with `not mutable`.
2. Read participating `.harnessMutable` rules from top to bottom.
3. A matching non-negated rule changes state to `mutable`; a matching negated
   rule changes state back to `not mutable`.
4. The last matching participating mutable rule wins.

Section headers are optional in `.harnessMutable`:

- `[*]`, `[global]`, and `[mutable]` apply subsequent mutable rules globally.
- `[ignore]` is unsupported in `.harnessMutable`; ignore rules belong in
  `.harnessIgnore`. Tools MUST report
  `harness.mutable_ignore_section_unsupported` and MUST NOT apply rules below
  that unsupported header until another supported section header appears.
- Target-specific headers are unsupported for the same reason they are
  unsupported in `.harnessIgnore`. Tools MUST report
  `harness.ignore_unsupported_scope` and MUST NOT apply rules below that
  unsupported header until another supported section header appears.

Mutable files MUST still flow through the projection ignore step. If a file is
both ignored and marked mutable, the ignore decision wins because the file
never enters the projection in the first place.

### Local `.harnessIgnore` Files

Additional `.harnessIgnore` files MAY appear inside source locations and
inside existing target-output locations. They let a resource author or
consumer keep ignore rules next to the files they apply to, without
bloating the repo-root file.

Additional `.harnessMutable` files MAY appear inside source locations and
profile roots. They let a resource author keep seed-only ownership rules next
to the source template files they affect.

```text
.harnessIgnore                                  # root file
.harnessMutable                                 # root mutable file
.harness/resources/skills/review/.harnessIgnore           # source-local resource rules
.harness/resources/skills/review/.harnessMutable          # source-local mutable rules
.harness/resources/skills/review/.claude/.harnessIgnore   # source-local override rules
.harness/resources/skills/review/.claude/.harnessMutable  # source-local override mutable rules
resources/AGENTS.md/.harnessIgnore              # source-local custom dir rules
.agents/skills/review/.harnessIgnore            # target-output-local rules
notes/.harnessIgnore                            # target-output rules for dir outputs
```

The following rules apply:

- **Source-local rules.** A `.harnessIgnore` file under `./.harness`, under
  a configured resources source, or under a configured dir source
  matches source paths. A pattern like `*.tmp` in the default-path file
  `.harness/resources/skills/review/.harnessIgnore` matches
  `.harness/resources/skills/review/scratch.tmp` and
  `.harness/resources/skills/review/nested/scratch.tmp` but does NOT match
  `.harness/resources/skills/triage/scratch.tmp`.
- **Source-local mutable rules.** A `.harnessMutable` file under `./.harness`
  or under a configured resources source matches source paths with the same
  locality. It marks matching projected resource files as seed-only mutable
  files. Dir outputs are not mutable target files.
- **Target-output-local rules.** A `.harnessIgnore` file under an existing
  declared target root matches target output paths. A pattern like `*.tmp`
  in `.agents/skills/review/.harnessIgnore` matches an output path such as
  `.agents/skills/review/scratch.tmp`, regardless of whether the source was
  `.harness/resources/skills/review/scratch.tmp` or an override file. For
  dir outputs, implementations also discover `.harnessIgnore` files in
  existing ancestor directories of candidate output paths, such as
  `notes/.harnessIgnore` for an output `notes/release.md`.
- **Target-local controls.** Target-output `.harnessIgnore` files are local
  controls for the live harness surface, useful for temporary development
  preferences, machine-specific exclusions, or gitignored target folders where
  a developer needs to keep local runtime files out of the next activation.
  They adjust the output boundary without making the target folder a source
  root. Shared or first-activation rules belong in the repo-root or
  source-local `.harnessIgnore` files instead.
- **Scope of effect.** A local file participates only when the candidate
  source path or target output path is inside that file's directory.
- **Evaluation order.** Rule sets are evaluated in phases: the repo-root file
  first, then source-local and profile-local files in order of increasing
  logical directory depth, then target-output-local files in order of
  increasing logical directory depth. Within each rule set, rules are read top-to-bottom. The
  last-matching participating rule across all files wins. A deeper source or
  target file can therefore re-include a path that a shallower file in the
  same phase excluded, or exclude a path that a shallower file would have
  included. Target-output-local rules form the final output boundary for a
  target subtree and cannot be undone by profile-local source rules.
- **Logical location.** Every participating local `.harnessIgnore` has a
  logical location. Profile-local files participate at the profile root's
  logical overlay location. Target-derived override files participate at their
  logical source and target locations, not merely at the physical dot-folder
  used to store the override.
- **Same grammar.** Nested files support the same comments, negation,
  anchors, glob syntax, and supported section headers as the corresponding
  repo-root file.
- **Target-specific placement.** A nested `.harnessIgnore` inside a target
  output subtree is the target-specific mechanism. Target-specific section
  headers are invalid even inside override folders.
- **Synthetic ignore.** Every `.harnessIgnore`, `.harnessMutable`,
  `.harnessProfile`, and `.harnessProfileRoot` file is itself excluded from
  projection, equivalent to global declaration-file ignore rules.
  Implementations MUST NOT copy those declaration files into targets, even
  when no explicit rule excludes them. A target-output declaration file may
  still affect projection from its existing target location; it is read as a
  local control, not projected as managed target content.
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
each line and ignoring blank lines, it MUST contain zero or one profile name.
Zero profile names selects no profile for that output subtree. More than one
non-empty line MUST produce an error, and that selector MUST NOT participate
in projection. The repo-root `.harnessProfile` applies globally; a
target/output-local `.harnessProfile` applies to its directory and descendants,
and the nearest selector wins for any output path. Each output path has at most
one active profile at a time, although different target or dir output subtrees
may select different profiles with nearer target/output-local selectors.

Profile content is declared with `.harnessProfileRoot`, which MUST live under
`./.harness`, under a configured resources source, or under a configured dir
source. A `.harnessProfileRoot` file is UTF-8 text. After
trimming whitespace from each line and ignoring blank lines, it MUST contain
exactly one profile name. Zero profile names or more than one non-empty line
MUST produce an error, and that profile root MUST NOT participate in
projection. A `.harnessProfileRoot` MUST NOT be nested inside another profile
root. The directory containing `.harnessProfileRoot` is a profile root. It is
source storage, not a resource item, and MUST NOT be projected as a skill,
rule, plugin, dir output, or copied declaration file.

Profile roots overlay source paths by where the marker is placed:

- If the marker directory is an immediate child of a configured resources
  source or configured dir source, that marker directory overlays
  that source root. For example, under a conventional resources path,
  `.harness/resources/deploy/.harnessProfileRoot` overlays
  `.harness/resources`; children of `deploy/` become logical resource
  outputs.
- If the marker directory is nested deeper inside a configured resources
  source or configured dir source, that marker directory overlays
  its parent directory. This lets resource items carry portable local
  profiles. For example, under a conventional resources path,
  `.harness/resources/skills/example/aggressiveProfile/.harnessProfileRoot`
  overlays `.harness/resources/skills/example`, so
  `.harness/resources/skills/example/aggressiveProfile/SKILL.md` replaces
  the logical `.harness/resources/skills/example/SKILL.md` when that profile
  is active.
- Otherwise, a marker directory under `./.harness` overlays `./.harness`.
  This supports kit layouts such as
  `.harness/kits/deploy-kit/.harnessProfileRoot` with children like
  `resources/` and `dir/`.

During projection, profile overlays participate in the resource precedence
order defined in [Overrides](#overrides). A generic profile overlay therefore
cannot replace a target-specific override such as `.codex`; a
profile-specific `.codex` override can. If multiple active profile roots for
the selected profile project the same logical file, tools MUST use
deterministic last-wins ordering by profile root path and SHOULD report a
warning. Profile-local `.harnessIgnore` and `.harnessMutable` files match the
logical overlay path, not the storage path.
For example, an ignore file at
`.harness/profiles/personal/dir/AGENTS.md/.harnessIgnore` applies as if it
were located at `.harness/dir/AGENTS.md/.harnessIgnore`, so it can suppress
base composable parts before adding profile parts.

Source-local `.harnessIgnore` files that are physical ancestors of a profile
root also apply before the profile root is mapped onto its logical overlay
  path. For example, `.harness/kits/.harnessIgnore` can exclude
  `.harness/kits/deploy/**/.harness-cache/` metadata from the active `deploy` profile
even when files under that profile root overlay logical paths such as
`.harness/resources` or `.harness/dir`.

For dir sources, implementations MUST use a bootstrap/final flow: collect
candidate outputs with source-side rules and any known profile selectors,
discover target-output `.harnessIgnore` and `.harnessProfile` files in
candidate output ancestors, then recompute final outputs. Active profile
directories MUST also participate in candidate discovery, so a target-output
`.harnessProfile` can activate a profile-only dir output even when no base
dir source would have produced that output. Active profile directories may
contribute to an existing `.harnessComposable` leaf even when the profile
directory does not repeat the `.harnessComposable` marker.

## Reviewability

The source/projection boundary makes cross-surface differences reviewable:

- A diff under a configured resources source affects every target that
  projects that resource path.
- A diff under `.agents`, `.claude`, `.cursor`, or another override folder
  inside a resource item affects only targets that use that override.
- A diff in the repo-root `.harnessIgnore` changes projection exclusion
  boundaries globally; a diff in a nested `.harnessIgnore` changes projection
  only inside that file's source or target-output directory.
- A diff in `.harnessMutable` changes which projected source files become
  seed-only runtime-owned target files.
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
- Read-only path introspection, when provided by a tool, MUST be derived from
  the same inputs defined in [Copy Projection](#copy-projection) as activation.
- Live harness surfaces MUST be treated as projection targets, not source
  repositories.
- Teams MAY gitignore live harness surfaces because they are generated outputs;
  doing so does not change the source of truth or target declaration contract.
- Repositories that gitignore live harness surfaces SHOULD keep tracked
  activation instructions and SHOULD NOT gitignore the shared configured
  source roots required to regenerate those surfaces. Developer-local source
  roots MAY be gitignored when they are intentionally outside the shared
  source of truth.
- Activation MUST be idempotent for the same inputs defined in
  [Copy Projection](#copy-projection).
- Projection MUST honor `.harnessIgnore` so logs, metadata, caches, and
  implementation state stay out of live harness surfaces.
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
  trees can redirect reads or writes outside the repository if followed. v1
  implementations MUST treat symlinks as leaf entries and MUST NOT silently
  follow them. Replacing a target symlink that occupies a projected path MUST
  require an explicit target symlink policy, either from the selected manifest
  or from an equivalent operator-selected activation option.
- **TOCTOU on apply.** A target may be modified between planning and
  applying. Implementations SHOULD re-check the existence and managed/
  unmanaged classification of files at apply time, not only at plan time.
- **Unmanaged-entry deletion.** Cleanup deletes user files. The default
  policy MUST be preserve, and any deletion MUST be visible in the plan
  before it happens.
- **Mutable bypass.** `.harnessMutable` rules are an explicit "the runtime
  owns this after first projection" declaration. Implementations MUST NOT
  overwrite a mutable target without an explicit, user-visible force decision.
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
- New optional fields in `[[resources]]`, `[[targets]]`, or `[[dir]]` entries
  under the unknown-key rule.
- New unrecognized top-level tables or keys under the unknown-field rule when
  older tools can safely ignore them.
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
