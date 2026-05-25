# HarnessConfig Tooling

`harnessc` is the standard implementation of HarnessConfig. It exists so
repositories can validate the file shape, preview activation, and materialize
copy projections without writing a custom tool first.

Any other implementation that meets tool conformance is equally valid. The
standard is defined by the repository shape and activation contract, not by a
single binary.

## Commands

```bash
harnessc plan
harnessc init
harnessc validate
harnessc activate
harnessc extension activate
```

- `harnessc plan` inspects a repository, reports adoption work, and may show
  advisory hints for known runtime surfaces without making them implicit
  targets.
- `harnessc init` creates `.harness/harness.toml`, conventional or custom
  resource roots, and `.harnessIgnore` when applied with `--yes`.
- `harnessc validate` checks version support, resource declarations,
  repo-local paths, target mappings, projection ignore syntax, and mutable
  scope syntax.
- `harnessc activate` dry-runs the activation projection and shows creates,
  updates, requested removals, kept files, mutable-skipped files, and preserved
  unmanaged entries before writing.
- `harnessc extension activate` runs registered extensions. Use
  `--extension <id>` to run one declared extension or `--all` to run every
  declared supported extension.

`init`, `activate`, and `extension activate` are dry runs unless `--yes` is
supplied.
Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match `.harness`; use `--keep-unmanaged` to make
the default explicit.

Cleanup applies only to targets that are still declared in `harness.toml`.
After a target declaration is removed, base `harnessc activate` no longer
inspects or cleans that folder. Clean it first with `--remove-unmanaged`, or use
a higher-level activation-state workflow that can reconcile orphaned targets.

Managed files are compared directly with the current source projection: if the
target differs, `harnessc activate` reports `update` and applying activation
writes the current source bytes. Mutable files declared under `[mutable]` in
`.harnessIgnore` are created once and skipped on subsequent activations. Use
`--force-mutable` to re-project them from source.

Selection workflows, marketplace behavior, target edit review, capture, and
other product opinions belong above `harnessc`.

## Dir Composition And Copy

Declaring `[dir]` in `harness.toml` activates a single dir source root
(default `./.harness/dir`). Running `harnessc activate` planes and applies
dir outputs alongside target projection:

```toml
[dir]
path = "./.harness/dir"
```

```text
.harness/dir/
  AGENTS.md/
    .harnessComposable
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .harnessComposable
    .ref                       # ../AGENTS.md
    150_claude.md
  .github/
    copilot-instructions.md/
      .harnessComposable
      100_intro.md
  .claude/
    settings.json              # copy mode (no marker)
  notes/
    01_dev_intro.md            # copy mode (no marker)
```

Directories that contain an empty `.harnessComposable` marker file are
composable leaves: their numeric-prefix parts (for example `100_intro.md`,
`200_rules.md`) concatenate in order to produce the output file. Directories
without the marker are copy folders: their files and nested files copy to
the matching repo-relative path. Individual files at any depth also copy.

`.ref` files inside a composable leaf import another leaf's parts. Imported
and local parts are sorted together, duplicate numbers remain additive, and
cycles or missing refs are reported as errors.

Source-side `.harnessIgnore` rules apply during dir collection, including
rules inside a `.harnessComposable` leaf and rules inside a custom `[dir]`
source outside `./.harness`. Ignoring a container skips all dir outputs
below it, ignoring a leaf skips that output, and ignoring a part excludes
that part from composition. Target-output `.harnessIgnore` files can also
filter dir outputs by final output path after the candidate output structure
is known. Only global ignore rules participate for dir outputs; scoped
target headers are ignored in this mode. The `.harnessComposable` marker
itself is never copied to any output.

Profile overrides use `.harnessProfile` selectors and `.harnessProfileRoot`
source overlays. A root `.harnessProfile` applies globally; target/output
selectors such as `.agents/skills/.harnessProfile` apply only to that output
subtree. `.harnessProfileRoot` must live under `.harness`; when active, its
contents overlay either the parent source root (for markers directly inside a
resource or dir root) or `.harness` (for kit-style folders). Profile-local
`.harnessIgnore` files match those logical overlay paths, including
`.harnessComposable` leaves.

Dir output paths that fall under a declared `[[targets]]` path merge into
that target's projection — running activation a second time converges to
`keep` actions for those files, including target unmanaged-entry cleanup.
A dir output that would replace or contain a target root itself (for
example a dir output at `.claude` when `./.claude` is declared as a
target) is reported as `harness.dir_output_target_overlap`.

## Extensions

`harnessc` ships with an extension registry for forward-compatibility.
This release ships no built-in extension implementations; tools that
declare `[extensions.<id>]` for unsupported ids see an informational
diagnostic instead of behavior. The dir composition and copy surface above
is part of core activation, not an extension.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

The core standard owns `version` and `activation`. Extension-specific
fields belong to the registered extension implementation. Plain
`harnessc extension activate` runs only extensions configured with
`activation = "auto"`.

## TypeScript Helpers

Editors, CI scripts, and internal tools can embed the same behavior through
`@harnessconfig/core`:

```ts
import {
  applyHarnessActivation,
  loadHarnessIgnoreMatcher,
  parseHarnessConfigToml,
  planHarnessActivation,
  resolveHarnessPaths,
  validateHarnessConfig,
} from "@harnessconfig/core";

const paths = resolveHarnessPaths(process.cwd());
const config = parseHarnessConfigToml(rawToml);
const ignore = await loadHarnessIgnoreMatcher(paths.root);
const validation = await validateHarnessConfig(paths.root);
const activationPlan = await planHarnessActivation(paths.root);
const dryRun = await applyHarnessActivation(paths.root);
```

## Validator Checks

A conforming validator should:

- Locate the nearest `.harness` directory and use it as the canonical source
  root.
- Parse `.harness/harness.toml` and reject malformed input with clear
  diagnostics.
- Refuse unsupported future standard versions.
- Validate resource ids and repo-local resource paths.
- Verify each `[[targets]]` entry contains only a repo-local path and does not
  point at the source root.
- Parse `.harnessIgnore` with global, target-output-local, and `[mutable]`
  rules in declaration order.
- Resolve `.harnessProfile` selectors and `.harnessProfileRoot` overlays
  before projection, including the `[dir]` bootstrap/final pass for output
  selectors.
- Show create, update, remove, keep, preserve, and mutable actions before any
  write.
- Verify repeated activation against unchanged inputs converges to the same
  target tree for managed files and leaves mutable files untouched.
- Report runtime surfaces separately from durable resource roots.

## Output

The default output is a concise terminal report with paths, severity, and
suggested fixes. Tools may also expose stable `--json` output for automation
and CI.
