# Development And Release Process

This repository uses a `dev` to `main` release lane.

## Branches

- `dev` is the default development branch.
- Feature, fix, docs, and dependency branches start from `dev` and merge back
  to `dev` through pull requests.
- `main` is protected and release-only. It receives release pull requests from
  `dev`, not day-to-day feature work.
- Direct pushes to `main` should stay disabled. Emergency fixes should still use
  a pull request unless GitHub availability or credentials are the incident.

## Required Gates

CI runs `pnpm run quality`, which includes linting, type checks, tests, build,
and npm pack dry runs. Release publishing runs the same gate again from the tag
before publishing.

The intended `main` branch protection is:

- require a pull request before merging;
- require the `quality` status check;
- require branches to be up to date before merging;
- require conversation resolution;
- block force pushes and branch deletion;
- do not require approving reviews for maintainer-authored pull requests.

That keeps `main` protected while allowing a solo maintainer to merge after
CI, self-review, and recorded Codex review evidence.

## Codex Review Pattern

Use Codex as an explicit review pass for changes with real project risk:

- public standard or conformance wording;
- CLI behavior, activation semantics, or filesystem mutation;
- release automation and package publishing;
- security-sensitive code paths;
- broad refactors or dependency changes.

Ask for a code-review style pass and record the outcome in the pull request:
findings fixed, findings accepted as follow-up, or no issues found. Codex review
does not replace maintainer accountability.

## Release Flow

All publishable packages use the same version:

- root package metadata;
- `@harnessconfig/core`;
- `@harnessconfig/cli`;
- `harnessc`.

Release steps:

1. Prepare a release pull request from `dev` to `main`.
2. Update package versions and internal package dependency versions together.
3. Update `docs/RELEASE_NOTES.md` and complete `RELEASE-CHECKLIST.md`.
4. Merge the release pull request to `main` after CI passes.
5. Tag the exact `main` merge commit:

   ```bash
   git checkout main
   git pull --ff-only origin main
   git tag -a v1.0.0-alpha.1 -m "v1.0.0-alpha.1"
   git push origin v1.0.0-alpha.1
   ```

6. The release workflow verifies that the tag points at a commit on `main`,
   checks that package versions match the tag, reruns quality, publishes npm
   packages, and creates the GitHub release.

During the v1 alpha, every release tag publishes packages with the npm
`latest` dist-tag, including prerelease versions such as `1.0.0-alpha.5`.
The GitHub release is also explicitly marked as the latest release. This keeps
the default npm package page and `npx harnessc` install path pointed at the
current alpha until the project chooses a separate prerelease channel policy.

Before pushing a release tag, configure npm trusted publishing for each
publishable package:

- publisher: GitHub Actions;
- organization/user: `reachjalil`;
- repository: `harness-config`;
- workflow filename: `release.yml`;
- environment name: blank;
- allowed action: `npm publish`.

No `NPM_TOKEN` repository secret is used. The release workflow publishes through
GitHub Actions OIDC with `id-token: write`. The release job uses Node 24 so
the bundled npm CLI is new enough for trusted publishing.
