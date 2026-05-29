# Harness config diagnostic codes

This catalog lists every diagnostic code a v1 conforming tool may emit. Tools
SHOULD prefer the codes in this catalog when reporting equivalent conditions so
that downstream automation, editors, and CI systems can rely on stable
identifiers across implementations.

Codes use the namespace `harness.*`. New conditions added under v1 MUST follow
the `harness.<area>_<condition>` convention and SHOULD be added to this
catalog. Conforming tools MAY emit additional codes in their own namespace
(`my-tool.*`); they MUST NOT emit codes in `harness.*` that are not in this
catalog.

A diagnostic has a severity, an optional path, a human-readable message, and an
optional recommendation. Severity is one of:

- `error`   — blocks activation; tools MUST NOT write target files until the
  condition is resolved.
- `warning` — does not block activation but indicates a likely repository
  configuration issue. Tools SHOULD surface warnings prominently in CI.
- `info`    — informational. Tools MAY suppress info-level diagnostics in
  human output but SHOULD include them in `--json` output.

## Filesystem and manifest

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.config_missing` | warning | The selected manifest file is missing. |
| `harness.config_invalid` | error | The selected manifest could not be parsed or failed schema validation. |
| `harness.manifest_unknown_field` | info | The selected manifest contains an unrecognized key or table reserved for future v1 revisions. |
| `harness.root_not_directory` | error | `./.harness` exists but is not a directory. |
| `harness.ignore_not_file` | error | `.harnessIgnore` exists but is not a regular file. |
| `harness.ignore_missing` | warning | `./.harness/` exists but the repo-root `.harnessIgnore` is missing. |
| `harness.mutable_not_file` | error | `.harnessMutable` exists but is not a regular file. |
| `harness.path_not_repo_local` | error | A configured path resolves outside the repository or contains `..`. |
| `harness.activation_config_unavailable` | error | The selected manifest could not be loaded as an activation manifest. |
| `harness.source_path_overlapping` | error | Two configured `[[resources]]` or `[[dir]]` source roots overlap. |
| `harness.target_overlaps_source_path` | error | A `[[targets]]` path overlaps a configured source root. |
| `harness.target_duplicate_path` | error | Two `[[targets]]` entries normalize to the same path. |
| `harness.target_overlapping_path` | error | Two `[[targets]]` entries overlap (one contains the other). |
| `harness.target_symlink_conflict` | error | A target symlink occupies a path the projection needs to write, and the target symlink policy is `conflict`. |

## Projection

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.projection_path_conflict` | error | Two projection inputs would land at the same logical path with incompatible file/directory shapes. |
| `harness.projection_read_failed` | warning | A source file could not be read during projection. The file is skipped. |

## Resource composable leaves

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.resource_composable_mixed_container` | error | A resource composable directory contains a subdirectory. |
| `harness.resource_composable_invalid_entry` | error | A resource composable directory contains a non-regular file. |
| `harness.resource_composable_invalid_part` | error | A composable part filename does not match the `<order>_<name>` pattern. |
| `harness.resource_composable_part_read_failed` | error | A composable part file could not be read. |
| `harness.resource_composable_ref_invalid` | error | A `.harnessRef` file does not contain exactly one relative path. |
| `harness.resource_composable_ref_absolute` | error | A `.harnessRef` target is an absolute path. |
| `harness.resource_composable_ref_outside_root` | error | A `.harnessRef` target escapes the resources source root. |
| `harness.resource_composable_ref_missing` | error | A `.harnessRef` target does not resolve to an included composable leaf. |
| `harness.resource_composable_ref_cycle` | error | Resource composable `.harnessRef` references form a cycle. |
| `harness.resource_composable_ref_read_failed` | error | A `.harnessRef` file could not be read. |

## Dir composition and copy

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.dir_root_not_directory` | error | A configured `[[dir]]` path does not resolve to a directory. |
| `harness.dir_read_failed` | error | A directory inside a dir source could not be read. |
| `harness.dir_entry_read_failed` | error | An entry inside a dir source could not be stat-ed. |
| `harness.dir_file_read_failed` | error | A file inside a dir source could not be read. |
| `harness.dir_marker_at_root` | error | A `.harnessComposable` marker file is at the dir source root. The marker must label a child directory. |
| `harness.dir_mixed_container` | error | A `.harnessComposable` directory contains a subdirectory. |
| `harness.dir_invalid_entry` | error | A non-regular file appears inside a `.harnessComposable` directory. |
| `harness.dir_invalid_part` | error | A composable part filename does not match the `<order>_<name>` pattern. |
| `harness.dir_part_read_failed` | error | A composable part file could not be read. |
| `harness.dir_ref_read_failed` | error | A `.harnessRef` file in a dir composable leaf could not be read. |
| `harness.dir_ref_invalid` | error | A `.harnessRef` in a dir composable leaf does not contain exactly one relative path. |
| `harness.dir_ref_absolute` | error | A `.harnessRef` in a dir composable leaf is an absolute path. |
| `harness.dir_ref_outside_root` | error | A `.harnessRef` in a dir composable leaf escapes the dir source root. |
| `harness.dir_ref_missing` | error | A `.harnessRef` in a dir composable leaf does not resolve to an included composable leaf. |
| `harness.dir_ref_cycle` | error | Dir composable `.harnessRef` references form a cycle. |
| `harness.dir_output_inside_source_root` | error | A dir output path would write inside `./.harness` or a configured source root. |
| `harness.dir_output_target_overlap` | error | A dir output path would replace or contain a declared target root. |
| `harness.dir_path_conflict` | error | Two dir outputs would land at incompatible paths (file/directory conflict). |

## Profiles

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.profile_empty` | error | A `.harnessProfileRoot` file has zero non-empty lines after trimming. The profile root does not participate in projection. |
| `harness.profile_invalid` | error or warning | A `.harnessProfile` or `.harnessProfileRoot` selector is malformed. Severity is `error` when the file is required by configuration; `warning` when it is purely advisory. |
| `harness.profile_read_failed` | error or warning | A profile selector file could not be read. Severity follows the same `required` rule as `harness.profile_invalid`. |
| `harness.profile_nested_root` | error | A `.harnessProfileRoot` is nested inside another `.harnessProfileRoot`. |
| `harness.profile_overlay_conflict` | warning | Multiple active profile roots project the same logical file. Deterministic last-wins ordering is applied. |
| `harness.profile_root_outside_source_roots` | error | A `.harnessProfileRoot` lives outside `./.harness`, a configured resources source, and a configured dir source. |

## Ignore and mutable

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.ignore_unsupported_scope` | error | A `.harnessIgnore` or `.harnessMutable` file uses an unsupported target-specific section header (such as `[.claude]` or `[!.cursor]`). |
| `harness.ignore_mutable_section_unsupported` | error | A `.harnessIgnore` file uses the legacy `[mutable]` section header. Move mutable declarations into `.harnessMutable`. |
| `harness.mutable_ignore_section_unsupported` | error | A `.harnessMutable` file uses an `[ignore]` section header. Move ignore declarations into `.harnessIgnore`. |

## Extensions

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.extension_config_unavailable` | error | The manifest could not be loaded while planning extension activation. |
| `harness.extension_config_invalid` | error | The manifest could not be parsed while planning extension activation. |
| `harness.extension_selection_conflict` | error | `--extension` and `--all` were both supplied, or another mutually exclusive selection was made. |
| `harness.extension_undeclared` | error | A requested extension id is not declared in the manifest. |
| `harness.extension_unsupported` | error | A declared extension is not implemented by the running tool. |
| `harness.extension_incompatible` | error | A declared extension's `version` is unsupported by the running tool's registered implementation. |
| `harness.extension_config_version_unsupported` | error | An extension's configuration `version` field is outside the supported range for the running tool. |

## Init

| Code | Severity | Meaning |
| --- | --- | --- |
| `harness.init_invalid_resource_kind` | error | A resource kind requested via `--resource` does not match the `^[a-z][a-z0-9_-]*$` resource-id pattern. |
| `harness.init_target_existing_entries` | info | A declared target folder already contains files. Init declares targets but does not adopt existing runtime files into configured source roots. |

## Versioning of this catalog

This catalog is part of the v1 standard. Within v1, additional `harness.*`
codes MAY be added to this catalog and existing codes MAY receive editorial
clarifications. Removing a code or changing its meaning is reserved for v2.

Tools MUST NOT depend on diagnostic messages being byte-for-byte stable;
messages and recommendations are intentionally writeable. Tools MAY depend on
the code, severity, and the conditions described above remaining stable inside
v1.
