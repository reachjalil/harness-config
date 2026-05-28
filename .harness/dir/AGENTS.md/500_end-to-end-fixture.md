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

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"

[[targets]]
path = "./.claude"

[[dir]]
path = "./.harness/dir"
TOML

cat > "$tmp/.harnessIgnore" <<'EOF'
.harness/**/logs/
EOF

cat > "$tmp/.harnessMutable" <<'EOF'
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
