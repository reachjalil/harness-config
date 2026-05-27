---
title: Overview
seoTitle: .harness Config Overview
socialTitle: A neutral source layout for agent harness configuration
description: A source layout and activation model for advanced, predictable agent harness configuration across runtimes, teams, profiles, and local controls.
socialDescription: An overview of how .harness uses dry-run activation, projection boundaries, profile overlays, target-local controls, and explicit targets to make agent configuration more capable without making it implicit.
canonicalPath: /specifications/v1/
slug: overview
order: 0
locale: en
sectionCode: "00"
summary: The source layout, activation model, projection controls, profile overlays, target-local controls, and practical operating benefits in one read.
llmSummary: Introduces .harness as a repository-owned source catalog for agent configuration, with dry-run activation, composable instruction files, profile overlays, target-local controls, and explicit runtime projections that make advanced configuration predictable, reviewable, and reusable.
audience: Technical readers and implementers evaluating repository-local agent configuration.
contentKind: spec
status: draft
updated: 2026-05-26
---

# A neutral source layout for agent harness configuration

Agent runtimes expose live folders such as `.agents`, `.claude`, `.gemini`, and `.cursor`. Those folders are useful runtime surfaces, but they are a weak source of truth when several tools need the same skills, rules, plugins, and instruction files.

Harness config keeps reusable agent resources in configured repository-owned source roots, conventionally under `.harness`, declares every runtime output as an explicit target, and materializes each target through a dry-run-first copy projection. Runtime folders stay live and tool-friendly. The reviewed source remains stable.

## Why Activation Matters

Activation is the operational payoff of the standard. It turns agent configuration from a set of live folders into a repeatable projection step: read the source catalog, apply profiles and target-specific differences, filter the boundary, preview the plan, then write ordinary files only after review.

That boundary gives useful secondary behavior without making `.harness` a full product platform. CI can validate the same manifest a developer uses locally. Editors can preview what a runtime will receive. Review tools can show which target files are created, updated, preserved, or intentionally left mutable. Multiple runtimes can consume the same source resource without treating any one runtime folder as the canonical format.

The result is not more ceremony around agent configuration. It is less hidden state: a small standard that makes activation explainable, repeatable, and safe enough to automate.

## Advanced Configuration, Predictable Shape

The standard supports expressive configuration without making activation opaque. Profiles let a team, developer, or target subtree select a configuration layer. `[dir]` composition lets shared instruction files be assembled from reviewed parts. Target-output `.harnessIgnore` and `.harnessProfile` files let a live runtime surface keep local controls without promoting those controls back into canonical source.

These features are intentionally indirect. They do not ask every tool to invent a new settings UI, registry, or synchronization service. They give tools a stable file contract they can inspect: what source exists, which profile is active, which target receives which projection, what is filtered out, and what will be preserved during cleanup.

That is the core value of the standard: advanced configurability with a predictable activation plan. A platform team can ship a security or deployment kit. A project can compose `AGENTS.md` from shared sections. A developer can keep a local target preference. A CI job can still explain the same result from files in the repository before anything is written.

## What It Does

Harness config answers four practical questions:

- **Where does durable agent configuration live?** In configured source roots, under `.harness/` by default, not in a runtime folder that a tool may also write.
- **Which live folders receive generated files?** Only the paths declared as `[[targets]]` in the selected manifest, which defaults to `./.harness/harness.toml`.
- **What is allowed to cross the projection boundary?** `.harnessIgnore` files can filter by source path and by final output path.
- **How do teams vary the output safely?** Target-derived overrides handle runtime differences; profile overlays handle team kits, personal customizations, and target-local variants.
- **How does local variation stay accountable?** Target-output profiles and ignores are preserved as live controls, while activation still reports the computed plan before writing.

## What The Standard Defines

- The selected manifest, defaulting to `./.harness/harness.toml`, declares the standard version, optional `[resources] path`, optional `[dir]` source, and explicit `[[targets]]`.
- Resource folders live under the configured resources source, defaulting to `.harness/resources`, with kinds such as `.harness/resources/skills/<name>` or any custom directory a repository carries there. A `.harnessComposable` leaf in the resources source composes one projected resource file for each declared target.
- Target-derived override folders such as `.claude` or `.agents` live inside a resource and merge only when the matching target is projected.
- `.harnessIgnore` files define the projection boundary. The repo-root file can match source and output paths. Source-local files follow source paths. Target-output-local files follow final output paths and are preserved during cleanup.
- The optional `[dir]` source is separate from resources; it composes `.harnessComposable` leaves into repo-relative outputs such as `AGENTS.md`, or copies files to repo-relative output paths.
- `.harnessProfile` selects an active profile. `.harnessProfileRoot` declares a profile overlay root under `.harness`. Active overlays can add or override resources and `[dir]` composable parts without making the profile folder a normal projected item.

## Why It Helps

The complete catalog stays reviewable in one place. Runtime folders stay ordinary live surfaces that can be regenerated, cleaned, or ignored by Git when a team chooses.

Ignore and profile controls matter because real repositories have local variation. A team may want `.claude` to exclude one generated scratch file while `.agents` keeps it. A developer may want a personal `AGENTS.md` preface without changing team instructions. A platform group may ship a deploy kit that contributes skills and instruction parts only when selected. These workflows need precise output control, not another source tree hidden inside a runtime folder.

## Activation Flow

1. Parse the selected manifest and configured resources source.
2. Discover `.harnessProfile` selectors and active `.harnessProfileRoot` overlays.
3. Build the target projection from source resources, profile overlays, and matching target overrides.
4. Apply root, source-local, profile-local, and target-output `.harnessIgnore` rules using the correct source or output path for each rule set.
5. Compose or copy `[dir]` outputs and merge outputs that land under declared targets.
6. Preview creates, updates, mutable skips, removals, keeps, and preserved unmanaged entries before writing.

The important constraint is one-way ownership: `.harness/` is canonical, live targets are generated outputs, and target-output declaration files such as `.harnessIgnore` and `.harnessProfile` are protected local controls rather than projected source files.

## Open Proposal

Harness config is being developed as an open specification proposal. Feedback from real repositories, runtime authors, and tool builders is especially useful while the boundary is still small enough to reason about.

Use the [`reachjalil/harness-config`](https://github.com/reachjalil/harness-config) repository for questions, issues, compatibility notes, examples, and pull requests.
