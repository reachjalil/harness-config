# HarnessConfig Test Matrix

HarnessConfig tests should prove that activation is a deterministic projection:
the same `.harness` tree, `harness.toml`, override folders, and
`.harnessIgnore` rules produce the same live target trees.

## Covered Scenarios

| Area | Scenario | Test |
| --- | --- | --- |
| TOML | Valid `harness.toml` with default resources and path-only targets | `packages/core/test/standard.test.ts` |
| TOML | Unsupported standard versions fail validation | `packages/core/test/standard.test.ts` |
| TOML | Target entries reject fields other than `path` | `packages/core/test/standard.test.ts` |
| TOML | Target paths reject absolute paths, `..`, `.harness`, and non-dot live folders | `packages/core/test/standard.test.ts` |
| TOML | Duplicate targets, including explicit `.agents`, are diagnostics | `packages/core/test/standard.test.ts` |
| Ignore | Global patterns, directory patterns, `**`, `*`, and negation | `packages/core/test/standard.test.ts` |
| Ignore | Target-only sections such as `[.claude]` | `packages/core/test/standard.test.ts` |
| Ignore | Target-except sections such as `[!.cursor]` | `packages/core/test/standard.test.ts` |
| Ignore | Global reset sections such as `[*]` | `packages/core/test/standard.test.ts` |
| Projection | `.agents` copy projection with `.agents` overrides | `packages/core/test/projection.test.ts` |
| Projection | Additional target copy projection with target-derived overrides | `packages/core/test/projection.test.ts` |
| Projection | Nested override contents such as plugin manifests and nested skills | `packages/core/test/projection.test.ts` |
| Projection | Extension resource kinds declared in TOML | `packages/core/test/projection.test.ts` |
| Projection | Scoped `.harnessIgnore` changes target output independently | `packages/core/test/projection.test.ts` |
| Projection | Identical additional targets are still materialized as copy projections | `packages/core/test/projection.test.ts` |
| Projection | An existing target symlink is replaced with a copy projection | `packages/core/test/projection.test.ts` |
| Projection | Changed source files plan `update` actions | `packages/core/test/projection.test.ts` |
| Projection | Unmanaged target entries are preserved by default and summarized at one level | `packages/core/test/projection.test.ts` |
| Projection | Explicit unmanaged cleanup plans `remove` actions | `packages/core/test/projection.test.ts` |
| Projection | Re-running after apply converges to `keep` actions | `packages/core/test/projection.test.ts` |
| CLI | `harnessc activate` dry-runs by default | `packages/cli/test/run.test.ts` |
| CLI | `harnessc activate --yes` writes live targets | `packages/cli/test/run.test.ts` |
| CLI | `--remove-unmanaged` changes preserved unmanaged entries into removals | `packages/cli/test/run.test.ts` |
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
printf 'version = 1\n\n[[targets]]\npath = "./.claude"\n' > "$tmp/.harness/harness.toml"
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
