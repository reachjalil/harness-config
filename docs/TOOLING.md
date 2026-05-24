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

Managed files are compared directly with the current source projection: if the
target differs, `harnessc activate` reports `update` and applying activation
writes the current source bytes. Mutable files declared under `[mutable]` in
`.harnessIgnore` are created once and skipped on subsequent activations. Use
`--force-mutable` to re-project them from source.

Selection workflows, marketplace behavior, target edit review, capture, and
other product opinions belong above `harnessc`.

## Extensions

`harnessc` uses a static built-in extension registry. This release registers
the `dir` extension; dynamic package loading is intentionally out of scope.

Extensions are declared separately from core resources:

```toml
[extensions.dir]
version = 1
activation = "explicit"
path = "./.harness/dir"
```

The core standard owns `version` and `activation`. Extension-specific fields,
such as `path`, are validated by the registered extension. Declared extensions
default to explicit activation, so plain `harnessc extension activate` runs only
extensions configured with `activation = "auto"`.

### `dir`

The `dir` extension composes text files from mirrored leaf directories under
`./.harness/dir`:

```text
.harness/dir/
  AGENTS.md/
    100_intro.md
    200_rules.md
  CLAUDE.md/
    .ref
    150_claude.md
  .github/
    copilot-instructions.md/
      100_intro.md
```

Leaf directories become output files at the matching repository path. The
example writes `AGENTS.md`, `CLAUDE.md`, and
`.github/copilot-instructions.md`. Part files must start with a numeric prefix
and underscore, such as `100_intro.md`; using `100`, `200`, and `300` leaves
space for later insertions.

Part contents are concatenated exactly in sort order. The extension adds no
generated header, footer, separator, or newline normalization. File extensions
are not interpreted; any regular text file that follows the numeric naming
rule can be a part.

`.ref` imports another leaf directory using a relative path. Imported parts and
local parts are sorted together, duplicate numbers and names remain additive,
and cycles or missing refs are reported as errors.

Only global `.harnessIgnore` rules apply to `dir`; target-scoped rules do not.
Ignoring a container skips all outputs below it, ignoring a leaf skips that
output, and ignoring a part excludes that part from composition.

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
- Parse `.harnessIgnore` with global, target-scoped, and `[mutable]` rules in
  declaration order.
- Show create, update, remove, keep, preserve, and mutable actions before any
  write.
- Verify repeated activation against unchanged inputs converges to the same
  target tree for managed files and leaves mutable files untouched.
- Report runtime surfaces separately from durable resource roots.

## Output

The default output is a concise terminal report with paths, severity, and
suggested fixes. Tools may also expose stable `--json` output for automation
and CI.
