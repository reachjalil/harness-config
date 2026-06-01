# Specification content

This directory mirrors the normative specification text from `docs/` for the
public website. The English version under `en/` is byte-identical to the docs
sources (excluding YAML frontmatter), enforced by the documentation sync
test in `packages/core/test/docs.test.ts`.

## Authoritative version

The **English** version under `en/` is normative. When a translated section
disagrees with the English text or with a section under `docs/`, the English
text under `docs/` is authoritative.

Tools, validators, and conformance tests MUST be derived from the English
specification text. Translations are provided as a courtesy for adopters who
read other languages but MUST NOT be used as the source of truth for
conformance claims.

## Languages

| Locale | Status | Maintainer |
| --- | --- | --- |
| `en` | Authoritative | Project maintainers |
| `fr-fr` | Community translation | Contributions welcome |
| `zh-cn` | Community translation | Contributions welcome |
| `es` | Community translation | Contributions welcome |

A translation is considered current when its section files cover the same
section-level structure as the matching `en/` files. Translations may lag the
English text between releases. Each translated file SHOULD carry the same
`updated:` date in its frontmatter as the English file it was translated from
so that adopters can see how recent the translation is.

## Contributing a translation

To add a new locale or update an existing one:

1. Copy the matching `en/<section>.md` file into the target locale folder.
2. Update the `locale`, `title`, `seoTitle`, `socialTitle`, `description`,
   `socialDescription`, `summary`, `llmSummary`, and `audience` frontmatter
   fields. Keep `canonicalPath`, `slug`, `order`, `sectionCode`, and
   `contentKind` identical to the English version. Set `updated:` to the same
   date as the source English file.
3. Translate prose. **Keep RFC 2119 keywords in English uppercase** (MUST,
   MUST NOT, SHOULD, SHOULD NOT, MAY, etc.) so that normative force survives
   translation. RFC 2119 §1 only assigns normative meaning to the uppercase
   English keywords; lowercased or translated equivalents are non-normative
   prose.
4. Keep file and directory names, configuration keys, TOML examples, code
   blocks, diagnostic codes, and other identifiers in their original form.
   Translate only the surrounding human language.
5. Run the website build to confirm formatting.

Each section SHOULD be either fully translated or absent. Partial translations
inside a section can mislead adopters who skim for normative requirements.

## Sync guarantee

`packages/core/test/docs.test.ts` verifies that every `en/<section>.md` body
equals the matching `docs/<SECTION>.md` text. There is no automated equality
check for non-English locales because translated prose intentionally differs
from English. `packages/core/test/locales.test.ts` verifies that translated
sections keep the same `updated:` date, heading count, fenced-code delimiter
count, protected identifiers, diagnostic codes, documented flags, and uppercase
RFC 2119 keyword counts as the matching English section.
