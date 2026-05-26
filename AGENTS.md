# Repository Agent Guide

This repository defines the HarnessConfig v1 standard and its TypeScript
reference implementation. Treat `docs/STANDARD.md` as the normative contract,
`docs/TOOLING.md` as the CLI contract, and `docs/TESTING.md` as the scenario
map that must stay in sync with tests.

## Harness Identity

Use `.agents` as your HarnessConfig runtime context for this repository.
Treat `.agents` as a generated projection and edit `.harness` sources instead.

## Work Mode Boundary

Do not combine specification design and CLI implementation in one pass unless
the user explicitly asks for a coupled change. Prefer two deliberate efforts:

1. Specification work: decide the contract, conformance claim, and testing
   scenario first.
2. CLI work: implement the already-decided contract and prove it with focused
   tests.

When both are needed, recommend starting with the specification profile,
recording the expected behavior, then switching to the CLI profile for
implementation. This keeps design tradeoffs visible and prevents tests from
being shaped around an accidental implementation.

Local profile selection is intentionally not committed. To focus the agent,
write one profile name to `.harnessProfile`, activate, and keep the task inside
that boundary:

```bash
printf 'specification-development\n' > .harnessProfile
npx harnessc activate --yes

printf 'cli-development\n' > .harnessProfile
npx harnessc activate --yes
```

Remove `.harnessProfile` and activate again to return to the neutral guide.

## Working Rules

- Keep the standard implementation-neutral. Normative behavior belongs in
  `docs/STANDARD.md`; CLI flags and package names belong in `docs/TOOLING.md`,
  package READMEs, or tests.
- Do not make runtime folders implicit. `./.agents`, `./.claude`,
  `./.cursor`, and similar folders receive projection only when declared in
  the selected manifest.
- Preserve the one-way projection model. Source of truth is configured source
  roots; target folders are generated outputs, not source repositories.
- Use the standard filenames exactly: `.harnessIgnore`, `.harnessProfile`,
  `.harnessProfileRoot`, `.harnessComposable`, and `.harnessRef`.
- Treat `.harnessProfileRoot` as profile source only. It must live under
  `.harness`, the configured resources source, or the configured `[dir]`
  source, must not be projected as a resource item, and must overlay resources
  or `[dir]` outputs by logical source path.
- Keep `.harnessIgnore` as the projection boundary for global, source-local,
  target-output-local, and `[mutable]` rules.
- Prefer focused tests near the behavior being changed. Update
  `docs/TESTING.md` when a new standard or CLI scenario is added.
## Specification Source Of Truth

The open-source repository owns the specification source for both package
development and website publishing.

- Normative contract: `docs/STANDARD.md`.
- Conformance contract: `docs/CONFORMANCE.md`.
- CLI/tooling contract: `docs/TOOLING.md` and package READMEs.
- Website-ready specification content: `content/spec`.

The website copy at
`/Users/jalillaaraichi/workspaces-hub/sites/harness-config-site/content/spec`
is deployment content, not the authoritative source. When publishing the site,
copy from this repository into the site; do not make the site copy the only
place where specification changes live.


## Local Commands

Install and build before CLI smoke checks:

```bash
pnpm install
pnpm build
```

Focused checks:

```bash
pnpm --filter @harnessconfig/core test
pnpm --filter @harnessconfig/cli test
pnpm run check
pnpm run lint
```

Full release-quality gate:

```bash
pnpm run quality
```

Use the built CLI from this repo for manual verification:

```bash
node packages/cli/dist/bin.js validate --root <fixture>
node packages/cli/dist/bin.js plan --root <fixture>
node packages/cli/dist/bin.js activate --root <fixture>
node packages/cli/dist/bin.js activate --root <fixture> --yes
```
## Human Verification Checklist

Run this checklist before claiming the standard or CLI works end to end.

1. Read `docs/STANDARD.md` and confirm the changed behavior is defined there
   when it is part of the standard.
2. Read `docs/TOOLING.md` and `packages/cli/README.md` and confirm CLI
   behavior, flags, dry-run semantics, and output wording are documented.
3. Read `docs/CONFORMANCE.md` and confirm the repository, tool, projection,
   `[dir]`, profile, ignore, and mutable-file claims are testable.
4. Run `pnpm run quality`.
5. Run the manual fixture below and inspect the CLI output and resulting files
   as a human, not only through automated assertions.

Expected manual evidence:

- `validate` reports no diagnostics for a valid fixture.
- First `activate` without `--yes` reports creates but writes nothing.
- `activate --yes` writes declared targets and `[dir]` outputs.
- A second dry run converges to `keep` for managed files and `mutable` for
  runtime-owned files.
- `.claude` receives its `.claude` override while `.agents` receives the base
  file.
- Direct resource files project to target roots, with target-root overrides.
- Root `.harnessIgnore` excludes source logs.
- Target-output `.harnessIgnore` can filter one target while being preserved.
- `[mutable]` files are created once, then left untouched until
  `--force-mutable`.
- `[dir]` composition writes root files, follows `.harnessRef`, and merges outputs
  that land under a declared target.
- `.harnessProfile` selects a `.harnessProfileRoot` overlay for both resource
  projection and `[dir]` composition.

## End-To-End Fixture

Run from the repository root after `pnpm build`:

```bash
tmp="$(mktemp -d)"

mkdir -p \
  "$tmp/.harness/resources/.claude" \
  "$tmp/.harness/resources/skills/review/.claude" \
  "$tmp/.harness/resources/skills/review/logs" \
  "$tmp/.harness/dir/AGENTS.md" \
  "$tmp/.harness/dir/CLAUDE.md" \
  "$tmp/.harness/dir/.agents" \
  "$tmp/.harness/profiles/team/dir/AGENTS.md" \
  "$tmp/.harness/profiles/team/resources/skills/review" \
  "$tmp/.claude/skills/review"

cat > "$tmp/.harness/harness.toml" <<'TOML'
version = 1

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[dir]
path = "./.harness/dir"
TOML

cat > "$tmp/.harnessIgnore" <<'EOF'
.harness/**/logs/

[mutable]
.harness/**/settings.local.json
EOF

printf 'team\n' > "$tmp/.harnessProfile"
printf 'team\n' > "$tmp/.harness/profiles/team/.harnessProfileRoot"
printf 'base skill\n' > "$tmp/.harness/resources/skills/review/SKILL.md"
printf 'claude skill\n' > "$tmp/.harness/resources/skills/review/.claude/SKILL.md"
printf 'base hooks\n' > "$tmp/.harness/resources/hooks.json"
printf 'claude hooks\n' > "$tmp/.harness/resources/.claude/hooks.json"
printf 'seed local\n' > "$tmp/.harness/resources/skills/review/settings.local.json"
printf 'ignore me\n' > "$tmp/.harness/resources/skills/review/logs/run.log"
printf 'filtered for claude\n' > "$tmp/.harness/resources/skills/review/target-only.skip"
printf '*.skip\n' > "$tmp/.claude/skills/review/.harnessIgnore"

printf '' > "$tmp/.harness/dir/AGENTS.md/.harnessComposable"
printf 'base agents\n' > "$tmp/.harness/dir/AGENTS.md/100_base.md"
printf '' > "$tmp/.harness/dir/CLAUDE.md/.harnessComposable"
printf '../AGENTS.md\n' > "$tmp/.harness/dir/CLAUDE.md/.harnessRef"
printf 'claude tail\n' > "$tmp/.harness/dir/CLAUDE.md/200_claude.md"
printf 'target dir merge\n' > "$tmp/.harness/dir/.agents/dir-note.md"

printf 'profile agents\n' > "$tmp/.harness/profiles/team/dir/AGENTS.md/150_profile.md"
printf 'profile skill\n' > "$tmp/.harness/profiles/team/resources/skills/review/PROFILE.md"

node packages/cli/dist/bin.js validate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp"
test ! -f "$tmp/.agents/skills/review/SKILL.md"

node packages/cli/dist/bin.js activate --root "$tmp" --yes
node packages/cli/dist/bin.js activate --root "$tmp"

printf 'runtime local\n' > "$tmp/.agents/skills/review/settings.local.json"
node packages/cli/dist/bin.js activate --root "$tmp" --yes
grep -qx 'runtime local' "$tmp/.agents/skills/review/settings.local.json"

node packages/cli/dist/bin.js activate --root "$tmp" --yes --force-mutable
grep -qx 'seed local' "$tmp/.agents/skills/review/settings.local.json"

grep -qx 'base skill' "$tmp/.agents/skills/review/SKILL.md"
grep -qx 'claude skill' "$tmp/.claude/skills/review/SKILL.md"
grep -qx 'base hooks' "$tmp/.agents/hooks.json"
grep -qx 'claude hooks' "$tmp/.claude/hooks.json"
test -f "$tmp/.agents/skills/review/PROFILE.md"
test -f "$tmp/.claude/skills/review/PROFILE.md"
test -f "$tmp/.agents/skills/review/target-only.skip"
test ! -f "$tmp/.claude/skills/review/target-only.skip"
test ! -f "$tmp/.agents/skills/review/logs/run.log"
test -f "$tmp/.agents/dir-note.md"

printf '\nFixture root: %s\n' "$tmp"
printf '\nAGENTS.md:\n'
cat "$tmp/AGENTS.md"
printf '\nCLAUDE.md:\n'
cat "$tmp/CLAUDE.md"
printf '\n.agents projected files:\n'
find "$tmp/.agents" -type f | sort
printf '\n.claude projected files:\n'
find "$tmp/.claude" -type f | sort
```

Human review of the printed files should show:

```text
AGENTS.md:
base agents
profile agents

CLAUDE.md:
base agents
profile agents
claude tail
```
## Additional Manual Cases

For changes touching validation, also create small invalid fixtures and verify
clear non-zero diagnostics for:

- unsupported `version`,
- duplicate target paths,
- absolute paths or paths containing `..`,
- targets under `./.harness`,
- target entries with fields other than `path`,
- malformed `.harnessIgnore` or `[mutable]` sections,
- `.harnessProfileRoot` outside `.harness` and the configured source roots,
- overlapping configured resources, dir, or target paths,
- non-default manifest paths selected with `--config`,
- `[dir]` `.harnessRef` cycles, missing `.harnessRef` targets, mixed
  file/directory conflicts, and target root overlaps.

For changes touching cleanup, verify both defaults:

```bash
node packages/cli/dist/bin.js activate --root "$tmp"
node packages/cli/dist/bin.js activate --root "$tmp" --yes --keep-unmanaged
node packages/cli/dist/bin.js activate --root "$tmp" --yes --remove-unmanaged
```

Unmanaged entries must be preserved by default and removed only when
`--remove-unmanaged` is explicit. Target-output `.harnessIgnore` files must be
preserved even during unmanaged cleanup.
