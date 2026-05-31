# Harness Config Dogfood Plan

This repository should be the canonical reference implementation of Harness
config v1 in daily use. The plan below is dogfood, tooling, and content work;
it should not change `docs/STANDARD.md` semantics or `packages/*` core
behavior unless a later task explicitly asks for a coupled specification or
implementation change.

## A. Whole And Guarded Projection

- Project the public product skill from `library/` through the repo manifest so
  `library/skills/harness-config` flows into `.agents` and `.claude`.
- Keep `.harness/resources` as the repo's development skill root and `library/`
  as the public skill root. This exercises ordered multi-root resource layering
  without moving published skill source.
- Add a CI-visible dogfood check that uses the built repo-local CLI to validate
  the dogfood source, apply projection in an isolated copy, and prove the second
  dry run converges to `keep` or `mutable`.
- Consider a later `.cursor` target after the two-runtime loop is stable.

## B. Specialized Profiles

Replace cosmetic profile banners with profiles that include concrete
instructions and scoped resources:

- `specification-development`: focus on standard, conformance, and website-ready
  spec content.
- `cli-development`: focus on implementation, tests, and CLI behavior already
  decided by the specification.
- `internationalization`: focus on locale parity, untranslated identifiers, and
  docs locale checks.
- `examples-development`: focus on runnable examples under `examples/**`.
- `skill-authoring`: focus on adding and maintaining skills consistently.
- `release`: focus on release checklist, package scripts, and publishing.

Use profile roots with `dir/AGENTS.md/180_active-profile.md`, profile-local
`.harnessIgnore` rules, and targeted resource overlays where they add real
context.

## C. Richer Composed Instructions

Keep the existing composed `AGENTS.md` and `CLAUDE.md` model. Add command and
profile-switching parts when the profile work lands, and keep the live
`CLAUDE.md/.harnessRef -> ../AGENTS.md` pattern as the repo's own example of
dir composition.

## D. Automation Scripts

Add package scripts backed by `scripts/*.mjs`:

- `harness:activate`: regenerate `.agents`, `.claude`, `AGENTS.md`, and
  `CLAUDE.md` from `.harness` with the built CLI.
- `harness:check`: validate dogfood source and assert projection convergence in
  an isolated copy.
- `docs:check`: guard docs and `content/spec/en` sync plus locale parity.
- `examples:check`: validate and double-activate every runnable example.
- `skill:new <name>`: scaffold a new skill under `.harness/resources/skills`.
- `profile:new <name>`: scaffold a new profile root.

The first implemented slice is `harness:activate` and `harness:check`, wired
into `pnpm run quality` so CI proves the dogfood loop.

## E. Skill Refresh And Expansion

Refresh stale skill references first, especially invariants that mention
path-only manifests or old precedence language. Then add new skills for i18n,
examples, skill authoring, release, and optional dogfood workflows. Keep every
skill in the same anatomy: `SKILL.md`, `agents/openai.yaml`, and focused
`references/` files.

## F. Internationalization Profile

Add an `internationalization` profile and skill that keep RFC 2119 keywords in
English uppercase, leave filenames, TOML keys, diagnostic codes, flags, and
identifiers verbatim, translate prose only, and require locale guard checks
before completion.

## G. Examples

Keep `examples/**` as curated teaching repositories and this repo's `.harness`
as the advanced living example. The current examples cover multi-runtime
projection, profile switching, kits, composable instructions, runtime-owned
state, and layered local overlays. The later `examples:check` script should
guard them independently from the root dogfood projection.

## Sequencing

1. Implement A and the first D scripts.
2. Refresh stale skill references.
3. Build B, C, and F together.
4. Add example checks and deepen examples as needed.
5. Add the remaining new skills and scaffolders.

Every step should run the matching profile where available, then `pnpm run
harness:check`, and finally the focused tests or `pnpm run quality` for the
change size.
