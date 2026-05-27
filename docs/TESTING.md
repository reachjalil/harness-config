# Harness config Test Matrix

Harness config tests should prove that activation is a deterministic projection:
the same source trees, selected manifest, override folders, and
`.harnessIgnore` rules produce the same live target trees.

## Covered Scenarios

| Area | Scenario | Test |
| --- | --- | --- |
| TOML | Valid `harness.toml` with path-only targets, default `.harness/harness.toml` manifest path, and optional `[resources] path` | `packages/core/test/standard.test.ts` |
| TOML | Unsupported standard versions fail validation | `packages/core/test/standard.test.ts` |
| TOML | Target entries reject fields other than `path` | `packages/core/test/standard.test.ts` |
| TOML | Target paths reject absolute paths, `..`, `.harness`, duplicate normalized paths, and overlapping target roots while allowing arbitrary repo-local target folders | `packages/core/test/standard.test.ts` |
| TOML | Configured resources and dir source paths reject target overlaps and resolve independently from target roots | `packages/core/test/standard.test.ts` |
| TOML | Duplicate targets, including explicit `.agents`, are diagnostics | `packages/core/test/standard.test.ts` |
| TOML | Extension declarations parse with `version`, default `activation`, and extension-owned fields | `packages/core/test/standard.test.ts` |
| Ignore | Global patterns, directory patterns, `**`, `*`, and negation | `packages/core/test/standard.test.ts` |
| Ignore | Unsupported target-specific sections such as `[.claude]` and `[!.cursor]` | `packages/core/test/standard.test.ts` |
| Ignore | Global reset sections such as `[*]` | `packages/core/test/standard.test.ts` |
| Ignore | Source-local, target-output-local, root source/output, and shallow-first precedence | `packages/core/test/standard.test.ts` |
| Profiles | Root and target-local `.harnessProfile` selectors discover active profiles and protected target selectors | `packages/core/test/standard.test.ts` |
| Profiles | `.harnessProfile` and `.harnessProfileRoot` grammar, empty selector behavior, and multi-line severity | `packages/core/test/standard.test.ts` |
| Profiles | Nested `.harnessProfileRoot` declarations and profile roots outside configured source roots are diagnostics | `packages/core/test/standard.test.ts` |
| Projection | Explicit `.agents` copy projection with `.agents` overrides | `packages/core/test/projection.test.ts` |
| Projection | Default `.harness/resources` tree projects when `[resources]` is omitted, including direct files and target-root overrides | `packages/core/test/projection.test.ts`, `packages/cli/test/run.test.ts` |
| Projection | Custom `[resources] path` projects resources, target overrides, profile roots, and source-local ignores from the configured source root | `packages/core/test/projection.test.ts` |
| Projection | Activation can load a repo-local manifest from an explicit non-default config path | `packages/core/test/projection.test.ts`, `packages/cli/test/run.test.ts` |
| Projection | Resource files can be composed from `.harnessComposable` leaves, including `.harnessRef` imports, recipient-local `.harnessIgnore` filters, target-output `.harnessIgnore` boundaries, and profile overlays | `packages/core/test/projection.test.ts` |
| Projection | Additional target copy projection with target-derived overrides | `packages/core/test/projection.test.ts` |
| Projection | Override-local `.harnessIgnore` files act as target-output boundaries for base and profile resources while real target-output rules keep final precedence | `packages/core/test/projection.test.ts` |
| Projection | Nested override contents such as plugin manifests and nested skills | `packages/core/test/projection.test.ts` |
| Projection | Arbitrary resource kinds under the configured resources source project without per-kind manifest declarations | `packages/core/test/projection.test.ts` |
| Projection | Scoped `.harnessIgnore` changes target output independently | `packages/core/test/projection.test.ts` |
| Projection | Target-output `.harnessIgnore` filters one target and is preserved during cleanup | `packages/core/test/projection.test.ts` |
| Projection | Active `.harnessProfileRoot` overlays merge resources, suppress base resources with logical `.harnessIgnore`, and preserve target-local `.harnessProfile` during cleanup | `packages/core/test/projection.test.ts` |
| Projection | Target-output `.harnessIgnore` remains the final boundary when profile-local rules also match | `packages/core/test/projection.test.ts` |
| Projection | Target overrides stay above generic active profile overlays, while profile target overrides can still specialize targets | `packages/core/test/projection.test.ts` |
| Projection | Portable profile roots nested inside resource items overlay the containing item | `packages/core/test/projection.test.ts` |
| Projection | Multiple active profile roots projecting the same file emit a warning and resolve deterministically | `packages/core/test/projection.test.ts` |
| Projection | Activation planning reports profile diagnostics once despite shared dir/resource phases | `packages/core/test/projection.test.ts` |
| TOML | Target paths determine override folders from the first path segment | `packages/core/test/standard.test.ts` |
| TOML | Target paths are explicit repo-local paths and are not constrained to named runtime folders | `packages/core/test/standard.test.ts`, `packages/cli/test/run.test.ts` |
| Projection | Identical declared targets are still materialized as copy projections | `packages/core/test/projection.test.ts` |
| Projection | Target root and nested target symlinks are reported as unsupported diagnostics | `packages/core/test/projection.test.ts` |
| Projection | Changed source files plan `update` actions | `packages/core/test/projection.test.ts` |
| Projection | Unmanaged target entries are preserved by default and summarized at one level | `packages/core/test/projection.test.ts` |
| Projection | Explicit unmanaged cleanup plans `remove` actions | `packages/core/test/projection.test.ts` |
| Projection | Source deletion plus explicit cleanup removes stale target files | `packages/core/test/projection.test.ts` |
| Projection | Re-running after apply converges to `keep` actions | `packages/core/test/projection.test.ts` |
| Projection | Mutable files are created once and then reported as `mutable` | `packages/core/test/projection.test.ts` |
| Projection | Mutable files report `mutable` even when target bytes still match source | `packages/core/test/projection.test.ts` |
| Projection | Mutable files are not overwritten when bytes diverge in the target | `packages/core/test/projection.test.ts` |
| Projection | `--force-mutable` re-projects mutable files from source | `packages/core/test/projection.test.ts` |
| Projection | Ignore rules win when a file is both ignored and marked mutable | `packages/core/test/projection.test.ts` |
| Projection | Target byte changes plan `update` actions by direct comparison | `packages/core/test/projection.test.ts` |
| Dir | `[dir]` composes top-level, nested, dot-directory, and extensionless outputs with the `.harnessComposable` marker | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` `.harnessRef` imports parts and sorts them with local parts | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` honors only global `.harnessIgnore` rules during composition | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` honors source-local `.harnessIgnore` inside `.harnessComposable` leaves, including custom dir sources outside `.harness` | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` honors target-output `.harnessIgnore` for copy and composable outputs | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` active profile roots add composable parts and use logical `.harnessIgnore` files to suppress base parts | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` portable profile roots nested inside composable leaves can add profile parts | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` discovers target-output `.harnessProfile` selectors in the final bootstrap pass, including profile-only dir outputs with no base candidate | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` reports invalid parts, mixed containers, symlinks, `.harnessRef` errors, and target overlaps | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` reports create, update, and keep actions across activations | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` copies files from directories without the `.harnessComposable` marker | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` never copies the `.harnessComposable` marker file itself | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` outputs that fall under a declared target are merged into that target's projection | `packages/core/test/dir.test.ts` |
| Dir | `[dir]` outputs do nothing when `[dir]` is not declared even if the folder exists | `packages/core/test/dir.test.ts` |
| CLI | `harnessc activate` runs dir composition + copy alongside resource projection | `packages/cli/test/run.test.ts` |
| Ignore | `[mutable]` sections | `packages/core/test/standard.test.ts` |
| Docs | `STANDARD.md` stays independent of package names, repo paths, and CLI flags | `packages/core/test/docs.test.ts` |
| CLI | `harnessc init` dry-runs by default | `packages/cli/test/run.test.ts` |
| CLI | `harnessc init --yes` creates the standard files and resource folders under `.harness/resources` by default | `packages/cli/test/run.test.ts` |
| CLI | `harnessc init --config --resources-path --target --yes` writes a non-default manifest and activates from the configured resources source | `packages/cli/test/run.test.ts` |
| CLI | `harnessc activate` dry-runs by default | `packages/cli/test/run.test.ts` |
| CLI | `harnessc activate --yes` writes live targets | `packages/cli/test/run.test.ts` |
| CLI | `--remove-unmanaged` changes preserved unmanaged entries into removals | `packages/cli/test/run.test.ts` |
| CLI | `--keep-unmanaged` and `--remove-unmanaged` cannot be used together | `packages/cli/test/run.test.ts` |
| CLI | `--force-mutable` re-projects mutable files; default skips them | `packages/cli/test/run.test.ts` |
| CLI | Invalid activation TOML returns diagnostics and a non-zero exit | `packages/cli/test/run.test.ts` |
| CLI | Human output is colorized only for color-capable sinks, while `--json` stays unstyled | `packages/cli/test/run.test.ts` |
| CLI | `harnessc extension activate` reports unsupported extension selections and conflicting flags | `packages/cli/test/run.test.ts` |
| CLI E2E | `harnessc activate` runs composable + copy + `.harnessRef` + cross-target dir composition end-to-end | `packages/cli/test/run.test.ts` |
| CLI E2E | `harnessc activate` honors target-output `.harnessIgnore`, custom dir source ignores, and cleanup preservation | `packages/cli/test/run.test.ts` |
| CLI E2E | `harnessc activate` projects resource composables through target-output `.harnessIgnore`, target-local `.harnessProfile`, and unmanaged cleanup | `packages/cli/test/run.test.ts` |
| CLI E2E | `harnessc activate` applies profile roots across resources and composable dir outputs | `packages/cli/test/run.test.ts` |

## Manual Smoke Command

```bash
pnpm run quality
```

The quality gate runs linting, TypeScript checks, package tests, builds, and
package dry-runs.

For a focused activation smoke test:

```bash
tmp="$(mktemp -d)"
mkdir -p "$tmp/.harness/resources/.claude" "$tmp/.harness/resources/skills/review/.agents" "$tmp/.harness/resources/skills/review/.claude"
printf 'version = 1\n\n[resources]\npath = "./.harness/resources"\n\n[[targets]]\npath = "./.agents"\n\n[[targets]]\npath = "./.claude"\n' > "$tmp/.harness/harness.toml"
printf '.harness/**/logs/\n' > "$tmp/.harnessIgnore"
printf 'base\n' > "$tmp/.harness/resources/skills/review/SKILL.md"
printf 'agents\n' > "$tmp/.harness/resources/skills/review/.agents/SKILL.md"
printf 'claude\n' > "$tmp/.harness/resources/skills/review/.claude/SKILL.md"
printf 'shared hooks\n' > "$tmp/.harness/resources/hooks.json"
printf 'claude hooks\n' > "$tmp/.harness/resources/.claude/hooks.json"
node packages/cli/dist/bin.js activate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp" --yes
node packages/cli/dist/bin.js activate --root "$tmp"
```

The first command should report creates without writing. The second should
apply. The third should report keeps for the same source inputs.

For a focused update smoke test:

```bash
tmp="$(mktemp -d)"
mkdir -p "$tmp/.harness/resources/skills/review"
printf 'version = 1\n\n[resources]\npath = "./.harness/resources"\n\n[[targets]]\npath = "./.agents"\n' > "$tmp/.harness/harness.toml"
printf '' > "$tmp/.harnessIgnore"
printf 'source\n' > "$tmp/.harness/resources/skills/review/SKILL.md"
node packages/cli/dist/bin.js activate --root "$tmp" --yes
printf 'target edit\n' > "$tmp/.agents/skills/review/SKILL.md"
node packages/cli/dist/bin.js activate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp" --yes
cat "$tmp/.agents/skills/review/SKILL.md"
```

The dry run after editing the target should report `update 1` by direct
comparison. The apply should overwrite the target from source, and the final
`cat` should print `source`.

For a focused mutable smoke test:

```bash
tmp="$(mktemp -d)"
mkdir -p "$tmp/.harness/resources/skills/review"
printf 'version = 1\n\n[resources]\npath = "./.harness/resources"\n\n[[targets]]\npath = "./.agents"\n' > "$tmp/.harness/harness.toml"
printf '[mutable]\n.harness/resources/**/settings.local.json\n' > "$tmp/.harnessIgnore"
printf 'base\n' > "$tmp/.harness/resources/skills/review/SKILL.md"
printf 'source local\n' > "$tmp/.harness/resources/skills/review/settings.local.json"
node packages/cli/dist/bin.js activate --root "$tmp" --yes
printf 'target local\n' > "$tmp/.agents/skills/review/settings.local.json"
node packages/cli/dist/bin.js activate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp" --yes --force-mutable
cat "$tmp/.agents/skills/review/settings.local.json"
```

The dry run after editing the mutable target should report `mutable 1` and
leave the target file unchanged. The `--force-mutable` apply should overwrite
the mutable target from source, and the final `cat` should print
`source local`.
