# HarnessConfig Test Matrix

HarnessConfig tests should prove that activation is a deterministic projection:
the same `.harness` tree, `harness.toml`, override folders, and
`.harnessIgnore` rules produce the same live target trees.

## Covered Scenarios

| Area | Scenario | Test |
| --- | --- | --- |
| TOML | Valid `harness.toml` with declared resources and path-only targets | `packages/core/test/standard.test.ts` |
| TOML | Unsupported standard versions fail validation | `packages/core/test/standard.test.ts` |
| TOML | Target entries reject fields other than `path` | `packages/core/test/standard.test.ts` |
| TOML | Target paths reject absolute paths, `..`, `.harness`, and non-dot live folders | `packages/core/test/standard.test.ts` |
| TOML | Duplicate targets, including explicit `.agents`, are diagnostics | `packages/core/test/standard.test.ts` |
| Ignore | Global patterns, directory patterns, `**`, `*`, and negation | `packages/core/test/standard.test.ts` |
| Ignore | Target-only sections such as `[.claude]` | `packages/core/test/standard.test.ts` |
| Ignore | Target-except sections such as `[!.cursor]` | `packages/core/test/standard.test.ts` |
| Ignore | Global reset sections such as `[*]` | `packages/core/test/standard.test.ts` |
| Projection | Explicit `.agents` copy projection with `.agents` overrides | `packages/core/test/projection.test.ts` |
| Projection | Additional target copy projection with target-derived overrides | `packages/core/test/projection.test.ts` |
| Projection | Nested override contents such as plugin manifests and nested skills | `packages/core/test/projection.test.ts` |
| Projection | Extension resource kinds declared in TOML | `packages/core/test/projection.test.ts` |
| Projection | Scoped `.harnessIgnore` changes target output independently | `packages/core/test/projection.test.ts` |
| TOML | Target paths determine override folders from the first path segment | `packages/core/test/standard.test.ts` |
| Projection | Identical declared targets are still materialized as copy projections | `packages/core/test/projection.test.ts` |
| Projection | An existing target symlink is replaced with a copy projection | `packages/core/test/projection.test.ts` |
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
| Ignore | `[mutable]`, `[mutable .claude]`, and `[mutable !.cursor]` scopes | `packages/core/test/standard.test.ts` |
| Docs | `STANDARD.md` stays independent of package names, repo paths, and CLI flags | `packages/core/test/docs.test.ts` |
| CLI | `harnessc init` dry-runs by default | `packages/cli/test/run.test.ts` |
| CLI | `harnessc init --yes` creates the standard files and resource roots | `packages/cli/test/run.test.ts` |
| CLI | `harnessc activate` dry-runs by default | `packages/cli/test/run.test.ts` |
| CLI | `harnessc activate --yes` writes live targets | `packages/cli/test/run.test.ts` |
| CLI | `--remove-unmanaged` changes preserved unmanaged entries into removals | `packages/cli/test/run.test.ts` |
| CLI | `--keep-unmanaged` and `--remove-unmanaged` cannot be used together | `packages/cli/test/run.test.ts` |
| CLI | `--force-mutable` re-projects mutable files; default skips them | `packages/cli/test/run.test.ts` |
| CLI | Invalid activation TOML returns diagnostics and a non-zero exit | `packages/cli/test/run.test.ts` |

## Manual Smoke Command

```bash
pnpm run quality
```

The quality gate runs linting, TypeScript checks, package tests, builds, and
package dry-runs.

For a focused activation smoke test:

```bash
tmp="$(mktemp -d)"
mkdir -p "$tmp/.harness/skills/review/.agents" "$tmp/.harness/skills/review/.claude"
printf 'version = 1\n\n[resources.skills]\npath = "./.harness/skills"\n\n[[targets]]\npath = "./.agents"\n\n[[targets]]\npath = "./.claude"\n' > "$tmp/.harness/harness.toml"
printf '.harness/**/logs/\n' > "$tmp/.harnessIgnore"
printf 'base\n' > "$tmp/.harness/skills/review/SKILL.md"
printf 'agents\n' > "$tmp/.harness/skills/review/.agents/SKILL.md"
printf 'claude\n' > "$tmp/.harness/skills/review/.claude/SKILL.md"
node packages/cli/dist/bin.js activate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp" --yes
node packages/cli/dist/bin.js activate --root "$tmp"
```

The first command should report creates without writing. The second should
apply. The third should report keeps for the same source inputs.

For a focused update smoke test:

```bash
tmp="$(mktemp -d)"
mkdir -p "$tmp/.harness/skills/review"
printf 'version = 1\n\n[resources.skills]\npath = "./.harness/skills"\n\n[[targets]]\npath = "./.agents"\n' > "$tmp/.harness/harness.toml"
printf '' > "$tmp/.harnessIgnore"
printf 'source\n' > "$tmp/.harness/skills/review/SKILL.md"
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
mkdir -p "$tmp/.harness/skills/review"
printf 'version = 1\n\n[resources.skills]\npath = "./.harness/skills"\n\n[[targets]]\npath = "./.agents"\n' > "$tmp/.harness/harness.toml"
printf '[mutable]\n.harness/**/settings.local.json\n' > "$tmp/.harnessIgnore"
printf 'base\n' > "$tmp/.harness/skills/review/SKILL.md"
printf 'source local\n' > "$tmp/.harness/skills/review/settings.local.json"
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
