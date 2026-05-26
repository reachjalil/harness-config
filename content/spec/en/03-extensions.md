---
title: Extensions
seoTitle: .harness Extensions
socialTitle: Extension declarations for the .harness standard
description: How declared extensions add registered behavior without expanding the core resource projection schema.
socialDescription: How .harness extensions declare optional behavior while keeping the core projection schema small.
canonicalPath: /specifications/v1/extensions/
slug: extensions
order: 3
locale: en
sectionCode: "03"
summary: How declared extensions add registered behavior without expanding the core resource projection schema.
llmSummary: Describes how extensions are declared, versioned, activated, discovered, and kept separate from the core .harness projection model.
audience: Implementers adding optional behavior to .harness-compatible tools.
contentKind: spec
status: draft
updated: 2026-05-26
---

# Extensions

Extensions let tools add registered behavior without expanding the core resource and target projection schema. The base standard defines how extension declarations are discovered and when an implementation may run them; each extension owns its own schema, compatibility, diagnostics, planning, and writes.

## Declaration

Extension declarations live at the top level of the selected manifest, defaulting to `./.harness/harness.toml`, under `[extensions.<id>]`.

```toml
[extensions.example]
version = 1
activation = "explicit"
```

Core owns only two fields:

- `version`: a required positive integer for the extension's own config schema.
- `activation`: optional; `"explicit"` by default, or `"auto"` when the extension may run in routine activation flows offered by a tool.

Every other field belongs to the extension implementation. Unknown extension declarations should validate as repository shape, but selected unsupported behavior must fail clearly instead of being silently applied.

## Boundary With Core

An extension may add behavior, but it must not redefine the resources source, target mappings, target-derived overrides, `.harnessIgnore` semantics, `.harnessProfile` overlay semantics, mutable file behavior, unmanaged cleanup, or the activation plan contract.

The top-level `[dir]` source is part of core v1 activation, not an extension. It is documented in the Standard and Tooling pages because its outputs interact directly with declared targets, cleanup, and target-output `.harnessIgnore` files.

## Implementation Expectations

- Resolve selected extensions through an implementation-supported registry.
- Validate extension-owned fields before planning writes.
- Keep extension writes repo-local.
- Run dry-run-first and show create, update, keep, remove, or preserve actions before applying.
- Refuse selected unknown, undeclared, unsupported, incompatible, or unsupported-version extensions with clear diagnostics.
