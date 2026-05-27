# Release checklist

Use this checklist before publishing an npm package, creating a GitHub release,
or announcing a new Harness config release. Record the command output or a short
evidence note in the release PR or release issue.

## Release scope

- [ ] Release version, npm dist-tag, and target git ref are confirmed.
- [ ] Package versions are updated consistently across publishable packages.
- [ ] The release branch contains only intentional release changes.
- [ ] The release pull request targets `main` from `dev`.
- [ ] The maintainer self-review and Codex review notes are linked from the
      pull request when behavior, release automation, or security posture
      changed.

## Required gates

- [ ] Quality gate passes.
  - Run `pnpm install`.
  - Run `pnpm run quality`.
- [ ] Tests are green.
  - Run `pnpm run test`.
  - Run focused package tests when the release changes core or CLI behavior:
    `pnpm --filter @harnessconfig/core test` and
    `pnpm --filter @harnessconfig/cli test`.
- [ ] Docs are synced.
  - Check `docs/STANDARD.md`, `docs/TOOLING.md`, `docs/CONFORMANCE.md`,
    `docs/TESTING.md`, `docs/RELEASE_NOTES.md`, the root `README.md`, and
    package READMEs.
  - Check `content/spec/**` when the public specification copy changes.
  - If publishing the website, copy from this repository into the website
    deployment content; do not make the website copy the only source.
- [ ] Examples are validated.
  - Run the manual smoke commands in `docs/TESTING.md`.
  - Run the end-to-end fixture from `AGENTS.md` when activation, profiles,
    ignore rules, mutable files, cleanup, or `[dir]` composition changed.
  - Verify README and package README examples still match the built CLI.
- [ ] npm dry-run is validated.
  - Run `pnpm run publish:dry-run`.
  - Inspect package contents, entry points, README files, licenses, notices,
    and generated `dist` files before publishing.
- [ ] Changelog is updated.
  - Update `docs/RELEASE_NOTES.md` with user-visible behavior, compatibility
    notes, and package release details.
- [ ] Release notes are written.
  - Prepare the GitHub release notes from `docs/RELEASE_NOTES.md`.
  - Include install or upgrade commands and any known limitations.
- [ ] Migration notes are checked.
  - Confirm `docs/ADOPTION.md`, `docs/TOOLING.md`, package READMEs, and
    migration-oriented skill references still match the release behavior.
  - Call out breaking or behavior-changing steps in the release notes.
- [ ] Archive docs snapshot is captured.
  - Capture the release-state docs and spec content for later audit:
    `docs/**`, `content/spec/**`, package READMEs, and the root `README.md`.
  - Record the git tag or archive location in the release issue or release PR.

## Final publish check

- [ ] The git tag uses `vX.Y.Z` or `vX.Y.Z-prerelease` and points at the
      validated `main` commit.
- [ ] `pnpm run release:verify` passes.
- [ ] Published package versions match the tag and release notes.
- [ ] Post-publish install smoke check passes with the published package.
- [ ] Website and external documentation links resolve to the released version.
