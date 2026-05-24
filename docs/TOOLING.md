# HarnessConfig Tooling

`harnessc` is one implementation of the HarnessConfig standard, not its owner.
It exists so repositories can validate the file shape, preview activation, and
materialize copy projections without writing a custom tool first.

Any other implementation that meets tool conformance is equally valid. The
standard is defined by the repository shape and activation contract, not by a
single binary.

## Commands

```bash
harnessc plan
harnessc init
harnessc transition
harnessc validate
harnessc activate
```

- `harnessc plan` inspects a repository, reports adoption work, and may show
  advisory hints for known runtime surfaces without making them implicit
  targets.
- `harnessc init` creates `.harness/harness.toml`, conventional or custom
  resource roots, and `.harnessIgnore` when applied with `--yes`.
- `harnessc transition` moves durable source state from existing runtime
  folders into the standard layout with a reviewable report.
- `harnessc validate` checks version support, resource declarations,
  repo-local paths, target mappings, projection ignore syntax, and mutable
  scope syntax.
- `harnessc activate` dry-runs the activation projection and shows creates,
  updates, requested removals, kept files, drifted files, mutable-skipped
  files, and preserved unmanaged entries before writing.

`init`, `transition`, and `activate` are dry runs unless `--yes` is supplied.
Unmanaged target entries are kept by default. Use `--remove-unmanaged` when a
target should be cleaned to match `.harness`; use `--keep-unmanaged` to make
the default explicit.

Drifted managed files (target was modified after the last activation) are
reported as `drift` and are not overwritten by default. Use `--accept-drift`
to overwrite drifted files with the current projection. Mutable files
(declared under `[mutable]` in `.harnessIgnore`) are created once and skipped
on subsequent activations. Use `--force-mutable` to re-project them from
source. The two flags can be combined.

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
- Show create, update, remove, keep, preserve, drift, and mutable actions
  before any write.
- Verify repeated activation against unchanged inputs converges to the same
  target tree for managed files and leaves mutable files untouched.
- Report runtime surfaces separately from durable resource roots.
- Persist a per-target projection manifest under `./.harness/.state/` after
  each successful apply so drift can be detected on the next plan.

## Output

The default output is a concise terminal report with paths, severity, and
suggested fixes. Tools may also expose stable `--json` output for automation
and CI.
