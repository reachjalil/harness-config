# harnessc

[![Website](https://img.shields.io/badge/website-harnessconfig.dev-111827)](https://www.harnessconfig.dev/)
[![Specification](https://img.shields.io/badge/spec-proposal-111827)](https://www.harnessconfig.dev/specifications/v1/)
[![npm harnessc](https://img.shields.io/npm/v/harnessc?label=harnessc)](https://www.npmjs.com/package/harnessc)
[![Security](https://img.shields.io/badge/security-policy-111827)](https://github.com/reachjalil/harness-config/security/policy)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](./LICENSE)

Public npm package for the alpha Harness config CLI.

Harness config is a repository-local standard for keeping AI agent prompts,
skills, rules, plugins, and root instruction files in one reviewed `.harness`
source tree, then projecting them into explicit runtime folders such as
`.agents`, `.claude`, `.cursor`, and `.gemini`.

Run `harnessc` from anywhere inside a repository. It searches upward for
`./.harness/harness.toml`, validates the selected config, and prints the next
useful command.

```bash
npx harnessc
npx harnessc init
npx harnessc validate
npx harnessc activate
npx harnessc activate --yes
```

## Common Commands

```bash
harnessc
harnessc init
harnessc validate
harnessc activate
harnessc activate --yes
harnessc plan
```

## Links

- Website: https://www.harnessconfig.dev/
- Specification proposal: https://www.harnessconfig.dev/specifications/v1/
- GitHub: https://github.com/reachjalil/harness-config
- Issues: https://github.com/reachjalil/harness-config/issues
- Security policy: https://github.com/reachjalil/harness-config/security/policy

## Packages

- `harnessc`: public npm CLI package.
- `@harnessconfig/cli`: scoped implementation package used by `harnessc`.
- `@harnessconfig/core`: TypeScript reference implementation for tools.
