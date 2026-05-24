# HarnessConfig Rationale

Agent runtimes need live folders. Teams need a stable, reviewable source layout
for the resources those runtimes consume. HarnessConfig separates those
responsibilities without prescribing an application model for either.

The source catalog lives under `./.harness`. Runtime surfaces such as
`./.agents`, `./.claude`, or `./.cursor` remain live folders that their
runtimes read. Activation projects the reviewed catalog view into those
surfaces as ordinary files.

## Model

HarnessConfig defines four roles:

- Source catalog: durable resources under `./.harness/<kind>/<name>`.
- Target-derived override: a dot-prefixed folder inside a resource, such as
  `.claude`, that adjusts files for a target.
- Activation projection: the computed copy of source plus matching overrides
  into declared target paths.
- Projection boundary: `.harnessIgnore`, which decides which source files stay
  out of runtime surfaces.

## Why A Shared Standard

- Teams can inspect one repository-local contract across multiple agent tools
  instead of treating every live surface as a source format.
- A repository can hold the complete resource catalog while each runtime
  receives only the reviewed projection for that context.
- The contract is implementation-neutral: folders, TOML, ignore rules,
  overrides, and projection intent.
- New resource kinds can use `.harness/<kind>/<name>` before every runtime
  supports a native format.
- Each declared target projection is explicit, reviewable, and reproducible
  from source, ignores, overrides, and cleanup policy.
- Tools can show creates, updates, requested removals, unchanged projected
  files, and preserved unmanaged entries before changing a live folder.

## Extensions

Some workflows need repository-local behavior beyond target copy projection,
such as composing reviewed text fragments into root-level instruction files.
HarnessConfig keeps those workflows out of the core resource/target model by
declaring them as extensions. The base standard defines extension discovery and
activation policy fields, while each extension owns its schema, compatibility,
and behavior.

## Stakeholders

Platform teams can define one repo-local policy for storing harness resources,
reviewing changes, and validating paths in CI.

Tool builders can consume a stable resource model instead of scraping live
runtime folders or inventing another layout.

Security teams can review canonical source resources, activation intent, and
ignored files before anything reaches an execution surface.

Open-source projects can publish reusable agent instructions without choosing a
single agent runtime as the canonical format.

## Runtime-Owned Files

Agent runtimes frequently write into the folders they read. Permission grants,
allow-listed commands, and learned hooks land in files like
`.claude/settings.local.json`. HarnessConfig keeps activation one-directional
on purpose — projection always flows from source to target. The base standard
recognizes repo-declared mutable files but does not try to infer why target
bytes changed:

- Managed files are compared directly with the current projection. If target
  bytes differ, activation can report `update`.
- Mutable files are explicitly declared in `.harnessIgnore` under a `[mutable]`
  scope. The runtime owns them after the first projection. Projection creates
  them once and then leaves them alone, even when their bytes still match the
  source template.

Target edit review, reverse projection, and target-to-source capture are
legitimate follow-on workflows, but they depend heavily on version-control
practices and product UX. They belong in product layers on top of v1.

## Non-Goals

HarnessConfig does not standardize product workflows, hosted services,
marketplaces, distribution systems, recovery state, runtime behavior, grouping,
selection policy, target edit review, capture, or remote sync. Those belong in
products that build on top of the base standard.
