# Harness config adoption

This guide describes two paths: greenfield (no existing live agent folders)
and migration (a repository that already has `.claude/`, `.cursor/`,
`.agents/`, or similar).

## Greenfield

Harness config v1 starts from a small source contract:

1. Create `./.harness/harness.toml` with `version = 1`, or choose another repo-local
   manifest path and pass it explicitly to tooling.
2. Add resource folders and files under explicit `[[resources]]` source roots,
   commonly `.harness/resources`, such as
   `.harness/resources/skills`, `.harness/resources/rules`, or
   `.harness/resources/hooks.json`.
3. Declare every projection target explicitly in the selected manifest.
4. Use `.harnessIgnore` to keep source-only files out of live targets, and
   use `.harnessMutable` for runtime-owned files that should be seeded once.
   A mutable file should usually be a source template for local target state,
   not durable shared configuration.
5. Dry-run activation before writing target folders.

For a small first setup, show both the selected manifest and the source tree:

```toml
version = 1

[[resources]]
path = "./.harness/resources"

[[targets]]
path = "./.agents"
```

```text
AGENTS.md                         # tracked activation/root instructions
.harnessIgnore
.harnessMutable
.harness/
  harness.toml
  resources/
    README.md
    skills/
      review/
        SKILL.md
.agents/                          # generated after activation
```

Keep `AGENTS.md`, `CLAUDE.md`, or similar root instruction files as normal
tracked files when they are simple and already coherent. Move them into
`[[dir]]` only when generation, composition, profiles, or local overlays make
the repository easier to understand.

`harnessc` is the standard implementation for this workflow:

```bash
harnessc init
harnessc init --yes --resource skills --target ./runtime/agent
harnessc validate
harnessc explain .agents/skills/review/SKILL.md
harnessc activate
harnessc activate --yes
```

## Migrating an existing repository

A repository that already has harness surfaces such as `.claude/` or
`.cursor/` adopts Harness config incrementally. The shape of the migration
matters: the configured source roots must become the canonical input, not the
target.

Recommended sequence:

1. **Snapshot existing targets.** Commit the current live folders, or copy
   them to a branch. Adoption is reversible, but a known-good baseline
   makes review easier.
2. **Move durable content into a clear resources layout.** For the first full
   migration, prefer one `./.harness/resources` root and group inside it by
   usefulness: workflow, strategy, team, mode, agent set, product area, or kit.
   Most `.claude/skills/foo/` contents become
   `./.harness/resources/skills/foo/`. Files that differ only for one agent
   move into the matching item override folder (for example
   `./.harness/resources/skills/foo/.claude/`). Target-root files such as
   `.claude/settings.json` or `.claude/hooks.json` belong at the matching
   target-derived path under the resources root, such as
   `./.harness/resources/.claude/settings.json` or
   `./.harness/resources/.claude/hooks.json`. Add more configured resource
   roots only for optional concern catalogs such as testing, deployment, or
   UI work, separate ownership boundaries, profile-selected specializations,
   or local/private overlays.

   ```toml
   [[resources]]
   path = "./.harness/resources"

   [[resources]]
   path = "./.harness/local/resources"

   [[targets]]
   path = "./.agents"

   [[targets]]
   path = "./.claude"
   ```

   ```text
   .harness/
     resources/
       README.md
       .claude/
         settings.json
         .harnessMutable
       skills/
       prompts/
       rules/
       plugins/
     local/
       resources/
   ```

   This pairing keeps migration review concrete: reviewers can see which
   shared source root is projected, which target-level files are seeded, and
   which local source root is private or experimental.
   As the Harness config matures, teams can split concerns into additional
   roots such as `./.harness/resources-testing`,
   `./.harness/resources-deployment`, or `./.harness/resources-ui` and combine
   them with profile overlays or profile-specific dir instructions.
3. **Declare targets in the selected manifest.** Add a `[[targets]]` entry for
   each harness surface you want regenerated. A target only receives projections
   when it appears here. Declare every shared source with an explicit
   `[[resources]]` entry.
4. **Write `.harnessIgnore` and `.harnessMutable` deliberately.**
   Logs, scratch files, per-tool metadata, and skill `metadata.toml`
   typically belong under ignore rules because they should not cross the
   projection boundary. Files the runtime writes back (permissions, local
   settings, learned commands) belong in `.harnessMutable` when the source
   catalog should seed them once and the target runtime should own them after
   that. Copy those seed files into `.harness` before declaring them mutable,
   so fresh checkouts receive an initial version.
   Repository-wide rules usually live in `./.harnessIgnore`; resource- or
   dir-specific rules can live in source-local `.harnessIgnore` files, and
   user/local output preferences can live in target-output files such as
   `runtime/agent/skills/foo/.harnessIgnore`. Target-output files are useful
   when the live harness surface is gitignored and a developer needs a local,
   temporary boundary; shared rules should live in source. Precedence follows
   logical directory depth, so deeper source/profile rules can re-include
   selected paths while target-output rules remain the final boundary.
5. **Add profile overrides only where they clarify ownership.** Put
   `.harnessProfileRoot` under `.harness`, a configured resources source, or
   a configured dir source for optional kits or personal overlays, and
   select them with repo-root or target-output `.harnessProfile` files.
   Profile-local `.harnessIgnore` files can hide base files or composable
   parts for that profile and are evaluated at the profile overlay location.
   Use profiles as switchable modes across resource groups first, and as file
   overlays only when they genuinely add or replace content.
6. **Dry run, explain, review, then apply.** `harnessc activate` prints the
   plan without writing. Use `harnessc explain <path>` for a specific source
   or output that needs inspection, then review `create` / `update` /
   `remove` actions against the snapshot and re-run with `--yes`.
7. **Re-run activation.** A second dry run on unchanged inputs should
   converge to `keep` for managed files and `mutable` for runtime-owned
   files. If it does not, the source tree is still drifting from the
   target; reconcile before relying on the standard.

After migration, the live folders are derived: they can be removed and
regenerated from the configured source roots plus the manifest at any time.
Teams may also gitignore those live harness surfaces when they want more room
for local experiments, runtime state, or tool-specific scratch files. The
tradeoff is deliberate: review happens in `.harness` and the selected manifest,
managed target files stay reproducible, and `.harnessMutable` target files
keep runtime-owned state out of the canonical source tree.

## Gitignore recommendations

Use `.gitignore` only after the source of truth is clear:

- **Track shared Harness source.** Commit `.harness/harness.toml`, shared
  `.harness/resources/**`, `.harness/dir/**` when used, `.harnessIgnore`, and
  `.harnessMutable` declarations that are needed to reproduce generated
  outputs.
- **Gitignore generated harness surfaces after convergence.** Once activation
  converges and every durable resource is represented in `.harness`, folders
  such as `.agents/`, `.claude/`, `.cursor/`, and `.gemini/` can be ignored.
  Keep tracked activation instructions, such as a root instruction note,
  README setup step, or package script that runs validation and activation.
- **Gitignore local developer overlays when desired.** Use `.harness/local/`
  for private skills, prompts, experiments, and local dir overlays, then add it
  to `.gitignore` when those files should not be shared.
- **Do not rely on gitignored target-output controls for first activation.**
  A target-output `.harnessIgnore` or `.harnessProfile` participates only after
  it exists in the generated output. Put shared first-activation boundaries in
  source-local `.harnessIgnore` files or the repo-root `.harnessIgnore`.

Example after a complete migration:

```gitignore
# Harness-generated live surfaces
.agents/
.claude/
.cursor/
.gemini/

# Private Harness overlays
.harness/local/
```

Do not ignore all of `.harness/`; that would hide the manifest and reviewed
source required to regenerate the live harness surfaces.

## Common Pitfalls

- **Treating a live folder as both source and target.** Do not point a
  `[[targets]]` entry at a folder you also edit directly. The next
  activation will report drift or overwrite the live edits. If a folder
  must remain the source for now, leave it out of `[[targets]]`.
- **Forgetting to declare a target.** Resources project only to declared
  targets. A repository can have `./.harness/resources/skills/foo/` and
  `.claude/` on disk and still see "no creates" — because `./.claude` is not in
  `[[targets]]`.
- **Putting product or runtime state under `.harness/`.** `./.harness/`
  is for durable, reviewable source. Activation records, drift hashes, and
  product caches belong in product-owned folders such as `.harnex/` and
  in `.harnessIgnore`.
- **Putting target-root files in a kit by accident.** A target-root file such
  as `.claude/settings.json` should be represented at
  `.harness/resources/.claude/settings.json`, not inside a skill folder or an
  unrelated resource group. Mark it mutable when it should seed once and then
  become runtime-owned.
- **Using overrides to fork content broadly.** Override folders replace
  exact relative paths or add new files. They are intentionally a small
  hammer; if a target needs a very different version of a skill, prefer a
  separate resource item over a deep override tree.
- **Committing runtime-written files as if they were source.** Files like
  `.claude/settings.local.json` should typically be copied into `.harness` as
  a seed and declared in `.harnessMutable` so projection seeds them once and
  then leaves them alone. If the file later becomes shared policy, promote the
  desired bytes back into the configured source root and force mutable
  re-projection deliberately.
- **Expecting a target-output ignore file before it exists.** A
  target-output `.harnessIgnore` only participates after it is already on
  disk. Use the repo-root file for rules that must apply on first activation.
- **Projecting Harness config controls as payload.** Declaration files such as
  `.harnessIgnore`, `.harnessMutable`, `.harnessProfile`, and
  `.harnessProfileRoot` are read as controls and are not copied into targets
  as managed files.
- **Symlinking targets.** Harness config v1 does not follow symlinks. If a
  symlink occupies a path activation needs to write, activation reports a
  conflict by default. Replace the link manually, set
  `[activation].targetSymlinks = "replace"`, or use
  `--replace-target-symlinks` only when replacing the link itself is intended.

## Scope Reminder

The standard itself stays limited to the source layout, target declarations,
overrides, projection ignores, mutable files, and deterministic copy
projection. Product-specific selection, marketplace, target edit review,
activation records, capture, and remote sync belong above the base
standard.
