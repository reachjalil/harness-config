
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
