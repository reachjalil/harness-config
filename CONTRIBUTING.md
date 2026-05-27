# Contributing

Harness config is developed in the open from the `dev` branch. `main` is the
protected release branch and should only receive release-ready changes.

## Branch Flow

1. Branch from `dev`.
2. Open a pull request back to `dev` for normal work.
3. Keep specification decisions and CLI implementation in separate pull
   requests unless the change is intentionally coupled.
4. Use release pull requests from `dev` to `main`.
5. After a release pull request merges to `main`, create a signed or annotated
   `vX.Y.Z` tag on the merge commit to publish npm packages and create the
   GitHub release.

## Review Model

This repository is solo-maintainer friendly, but every meaningful change should
still have a review trail:

- CI must pass before merge.
- The author must self-review the pull request diff.
- Ask Codex for a review pass when a change affects behavior, release
  automation, security posture, or the public standard.
- Record the useful review notes, manual fixture evidence, or release checklist
  evidence in the pull request.
- Do not require a blocking human approval for maintainer-authored pull
  requests; that would prevent a solo maintainer from merging their own work.

For outside contributions, the maintainer reviews the pull request and may use
Codex as an additional reviewer. Codex review is evidence, not a replacement
for maintainer judgment.

## Local Checks

```bash
pnpm install
pnpm run quality
```

Focused checks are useful while developing:

```bash
pnpm --filter @harnessconfig/core test
pnpm --filter @harnessconfig/cli test
pnpm run check
pnpm run lint
```

For standard or CLI behavior changes, also follow the manual verification
checklist in `AGENTS.md` and keep `docs/TESTING.md` synchronized with new
scenarios.
