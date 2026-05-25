# HarnessConfig Rationale

Agent runtimes need live folders. Teams need a stable, reviewable source layout
for the resources those runtimes consume. HarnessConfig separates those
responsibilities without prescribing an application model for either.

The source catalog lives under `./.harness`. Runtime surfaces such as
`./.agents`, `./.claude`, or `./.cursor` remain live folders that their
runtimes read. Activation projects the reviewed catalog view into those
surfaces as ordinary files.

## The Concrete Problem

As of 2026, repositories that work with multiple AI coding agents commonly
carry several agent-specific top-level folders side by side: `.claude/`,
`.cursor/`, `.agents/`, `.codeium/`, `.continue/`, `.github/copilot-*`, plus
hand-maintained instruction files such as `AGENTS.md`, `CLAUDE.md`, or
`.github/copilot-instructions.md`. Each runtime reads one of these and
sometimes writes back into the same folder (permissions, allow-lists,
learned hooks).

This produces predictable, recurring pain in real repositories:

1. **Drift between near-duplicate folders.** The same skill or prompt is
   copy-pasted into `.claude/skills/foo/`, `.cursor/skills/foo/`, and so on.
   Edits in one runtime diverge from the others until a human reconciles
   them.
2. **Live folders are unreviewable as source.** A runtime-written file
   (`settings.local.json`, learned commands) ends up committed and reviewed
   as if it were authored content, or it is `.gitignore`d and silently
   diverges across contributors.
3. **No clean way to "turn off" a skill for one agent.** Removing files
   from a live folder either deletes work or requires per-runtime branching
   in CI scripts.
4. **Instruction files duplicate prose.** `AGENTS.md`, `CLAUDE.md`, and
   `copilot-instructions.md` repeat the same paragraphs, again drifting.
5. **No portable contract.** A new agent shipped tomorrow has no path that
   lets it consume the same source material a repository already maintains.

HarnessConfig addresses these by making one source layout (`./.harness/`)
canonical and reviewable, and every runtime surface an explicit projection
target derived from that source.

## Roles

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

## Relation To Existing Approaches

HarnessConfig draws on patterns that work in widely deployed systems. It is
not a generalization of any one of them; it borrows the parts that fit a
repo-local source-to-runtime projection problem and leaves the rest.

- **`.gitignore`-style pattern files** inspire `.harnessIgnore`'s syntax and
  ordered, last-match-wins precedence. Differences: `.harnessIgnore` adds
  source-local and target-output-local files plus a `[mutable]` kind, because
  projection has more dimensions than "tracked vs. untracked".
- **Helm / Kustomize overlays** (Kubernetes) inspire the idea of a base
  source tree composed with per-target overrides. HarnessConfig keeps the
  overlay scope narrower: a dot-prefixed folder *inside the resource item*
  whose first segment matches the target's first path segment, with no
  patch language and no templating. Override files either replace exact
  paths or add new ones; nothing else.
- **Profile-specific dotfile overlays** inspire `.harnessProfile` and
  `.harnessProfileRoot`: teams can keep optional kits or personal overlays
  under `.harness`, select them per repo or target-output subtree, and still
  review the final projection as file-level additions and replacements.
- **EditorConfig** inspired the choice of a single repo-root file with a
  small, declarative grammar that any tool can implement without runtime
  coupling.
- **Dotfile managers (chezmoi, GNU Stow, yadm)** address a related
  problem — projecting a curated source tree onto live system locations —
  for personal `$HOME` rather than per-repository agent surfaces. The
  source-of-truth / target-as-projection distinction, including the need
  for an "ignore for projection" filter, comes from that lineage.
- **Conventional commits / SemVer / RFC 2119** inspired the explicit
  normative language and forward-compatibility policy in
  [STANDARD.md](./STANDARD.md). A spec that future implementers can read
  in isolation is more likely to survive a change of maintainer.
- **`AGENTS.md`, `CLAUDE.md`, and `copilot-instructions.md`** are the
  immediate prior art for *what* gets projected. HarnessConfig does not
  define their content; it gives them one shared source location and a
  consistent way to compose them through the optional `dir` extension
  rather than hand-syncing duplicate prose.

What HarnessConfig deliberately does *not* try to be: a package manager, a
plugin runtime, a service mesh, a permission system, a templating engine,
or an agent SDK. Those are valuable but separable problems.
