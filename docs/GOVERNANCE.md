# Governance And Versioning

This document defines two things that are easy to conflate in a repository that
ships both a standard and its reference implementation:

1. the **version lines** the project maintains, and
2. the **change-control** rules that decide how each one moves.

The normative contract lives in [STANDARD.md](./STANDARD.md). This document is
not normative for repositories or tools; it is the project's own operating
policy. Where this document and `STANDARD.md` disagree about the standard,
`STANDARD.md` wins.

## Two Independent Version Lines

The project deliberately maintains two version axes. They move on different
cadences and for different reasons.

| Version line | Identifier | Where it is declared | Moves when |
| --- | --- | --- | --- |
| Specification version | `1` (a whole number) | The on-disk manifest `version = 1`, the `/specifications/v1/` URL space, and the "Versioning" section of [STANDARD.md](./STANDARD.md#versioning) | The normative contract gains an incompatible change (reserved for v2). |
| Implementation version | `1.0.0-alpha.7` (semver) | `package.json` for the root and for `@harnessconfig/core`, `@harnessconfig/cli`, and `harnessc` | Any reference-implementation release: features, fixes, prereleases. |

The single most important rule:

> A change to the implementation version **never** implies a change to the
> specification version. The reference implementation can publish any number of
> semver releases — `1.0.0-alpha.7`, `1.0.0`, `1.4.2` — while the specification
> stays at v1.

This is why `STANDARD.md` is implementation-neutral and the documentation sync
test forbids package names, repository paths, and CLI flags inside it. The
specification text describes a contract that any implementation can satisfy; the
package version describes one implementation of that contract.

### Current Mapping

| Specification | Implementation packages | Status |
| --- | --- | --- |
| v1 (proposal) | `@harnessconfig/core`, `@harnessconfig/cli`, `harnessc` at `1.0.0-alpha.7` | Alpha reference implementation |

When citing the project, cite the axis you mean. "Harness config v1" refers to
the standard. "`harnessc` 1.0.0-alpha.7" refers to the CLI build.

## Specification Change Control

### What may change within v1

Per [STANDARD.md](./STANDARD.md#versioning), within v1 the normative text may
receive:

- editorial clarifications that do not change behavior, and
- backward-compatible normative refinements, such as new optional fields with
  defined defaults, that do not invalidate an existing v1 repository or v1
  implementation.

### What is reserved for v2

Any change that would invalidate a conforming v1 repository or a conforming v1
implementation is a breaking change and is reserved for a future specification
version. v2 work, if it happens, gets its own `/specifications/v2/` space and
its own manifest `version` integer; v1 repositories keep working against v1
tooling.

### How a normative change is proposed

1. Open the change against `docs/STANDARD.md` (and `docs/CONFORMANCE.md` when it
   touches a conformance claim) as a specification pull request, separate from
   CLI implementation work, per [CONTRIBUTING.md](../CONTRIBUTING.md).
2. State the conformance impact explicitly: editorial, backward-compatible
   refinement, or v2-reserved breaking change.
3. Record the testing scenario in `docs/TESTING.md` before or alongside the
   implementation that proves it.
4. The website English content under `content/spec/en` is kept byte-identical to
   `docs/` by an automated sync test, so a normative change lands in both
   places in the same pull request. Translations may lag and are non-normative.

## Conformance Basis

A conformance claim is made against the **English specification text**, not
against the reference implementation's behavior. See
[CONFORMANCE.md](./CONFORMANCE.md) for the repository, tool, projection, dir,
profile, ignore, and mutable-file claims.

Today the executable conformance evidence is the reference implementation's own
test suite. A language-neutral conformance suite — fixtures plus expected
outputs that a third-party implementation can run without this repository's
TypeScript — is intended future work and is the natural artifact to extract if
the standard ever gains an independent implementation. Until then, an
implementation claims v1 conformance by satisfying the claims in
`CONFORMANCE.md`, not by matching `@harnessconfig/cli` byte for byte.

## When To Split The Repository

The standard and its reference implementation share one repository on purpose:
the documentation, translations, diagnostic catalog, and implementation are
kept honest by a single test gate, which makes spec-versus-implementation drift
structurally hard. Splitting them into separate repositories trades that
guarantee for independent release governance, and is only warranted when one of
these becomes true:

- a second independent implementation exists, so co-locating the standard with
  one implementation would signal favoritism;
- ownership of the standard diverges from ownership of the implementation;
- the conformance suite is extracted as a language-neutral artifact with its own
  consumers; or
- release cadences genuinely conflict in a way the shared version line obstructs.

Until then, the in-repository boundaries — implementation-neutral `STANDARD.md`,
the separate version lines above, and the specification-versus-CLI pull request
split — provide the separation without the cross-repository synchronization
cost.
