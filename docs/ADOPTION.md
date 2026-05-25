# HarnessConfig Adoption

This guide describes two paths: greenfield (no existing live agent folders)
and migration (a repository that already has `.claude/`, `.cursor/`,
`.agents/`, or similar).

## Greenfield

HarnessConfig v1 starts from a small source contract:

1. Create `.harness/harness.toml` with `version = 1` and at least one
   resource root.
2. Add resource roots such as `.harness/skills`, `.harness/rules`, or custom
   `.harness/<kind>` folders.
3. Declare every projection target explicitly in `harness.toml`.
4. Use `.harnessIgnore` to keep source-only files out of live targets and
   mark runtime-owned files with `[mutable]`.
5. Dry-run activation before writing target folders.

`harnessc` is the standard implementation for this workflow:

```bash
harnessc init
harnessc init --yes --resource skills --target ./.agents
harnessc validate
harnessc activate
harnessc activate --yes
```

## Migrating An Existing Repository

A repository that already has runtime-facing folders such as `.claude/` or
`.cursor/` adopts HarnessConfig incrementally. The shape of the migration
matters: the source root must become the canonical input, not the target.

Recommended sequence:

1. **Snapshot existing targets.** Commit the current live folders, or copy
   them to a branch. Adoption is reversible, but a known-good baseline
   makes review easier.
2. **Move durable content into `./.harness/<kind>/<name>/`.** Most
   `.claude/skills/foo/` contents become `./.harness/skills/foo/`. Files
   that differ only for one agent move into the matching override folder
   (e.g., `./.harness/skills/foo/.claude/`).
3. **Declare what moved in `harness.toml`.** Add a `[resources.<kind>]`
   table for each resource kind and a `[[targets]]` entry for each runtime
   folder you want regenerated. A target only receives projections when it
   appears here.
4. **Write `.harnessIgnore` for source-only artifacts.** Logs, scratch
   files, per-tool metadata, and skill `metadata.toml` typically belong
   under ignore rules. Files the runtime writes back (permissions, learned
   commands) belong under `[mutable]` so they survive future activations.
   Repository-wide rules usually live in `./.harnessIgnore`; resource- or
   dir-specific rules can live in source-local `.harnessIgnore` files, and
   user/local output preferences can live in target-output files such as
   `.agents/skills/foo/.harnessIgnore`.
5. **Add profile overrides only where they clarify ownership.** Put
   `.harnessProfileRoot` under `.harness` for optional kits or personal
   overlays, and select them with repo-root or target-output
   `.harnessProfile` files. Profile-local `.harnessIgnore` files can hide
   base files or composable parts for that profile.
6. **Dry run, review, then apply.** `harnessc activate` prints the plan
   without writing. Review `create` / `update` / `remove` actions against
   the snapshot, then re-run with `--yes`.
7. **Re-run activation.** A second dry run on unchanged inputs should
   converge to `keep` for managed files and `mutable` for runtime-owned
   files. If it does not, the source tree is still drifting from the
   target; reconcile before relying on the standard.

After migration, the live folders are derived: they can be removed and
regenerated from `./.harness` plus the manifest at any time.

## Common Pitfalls

- **Treating a live folder as both source and target.** Do not point a
  `[[targets]]` entry at a folder you also edit directly. The next
  activation will report drift or overwrite the live edits. If a folder
  must remain the source for now, leave it out of `[[targets]]`.
- **Forgetting to declare a target.** Resources project only to declared
  targets. A repository can have `./.harness/skills/foo/` and `.claude/`
  on disk and still see "no creates" — because `./.claude` is not in
  `[[targets]]`.
- **Putting product or runtime state under `.harness/`.** `./.harness/`
  is for durable, reviewable source. Activation records, drift hashes, and
  product caches belong in product-owned folders such as `.harnex/` and
  in `.harnessIgnore`.
- **Using overrides to fork content broadly.** Override folders replace
  exact relative paths or add new files. They are intentionally a small
  hammer; if a target needs a very different version of a skill, prefer a
  separate resource item over a deep override tree.
- **Committing runtime-written files as if they were source.** Files like
  `.claude/settings.local.json` should typically be declared under
  `[mutable]` so projection seeds them once and then leaves them alone.
- **Expecting a target-output ignore file before it exists.** A
  target-output `.harnessIgnore` only participates after it is already on
  disk. Use the repo-root file for rules that must apply on first activation.
- **Symlinking targets.** v1 implementations may report a symlink at a
  top-level target as a diagnostic and SHOULD NOT silently follow it.
  Replace with a real directory before activating.

## Scope Reminder

The standard itself stays limited to the source layout, target declarations,
overrides, projection ignores, mutable files, and deterministic copy
projection. Product-specific selection, marketplace, target edit review,
activation records, capture, and remote sync belong above the base
standard.
