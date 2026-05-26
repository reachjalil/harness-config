# Security Policy

Harness config projects files from repository-owned source trees into runtime
folders that AI agents and tools read. Treat source integrity, path safety, and
runtime-owned local settings as security-sensitive.

## Supported Versions

Security reports are accepted for the current v1 specification and the current
published `harnessc`, `@harnessconfig/cli`, and `@harnessconfig/core` packages.

## Reporting

Please report suspected vulnerabilities privately through GitHub Security
Advisories:

https://github.com/reachjalil/harness-config/security/advisories/new

For non-sensitive bugs, use GitHub issues:

https://github.com/reachjalil/harness-config/issues

## Security Scope

Relevant reports include:

- path traversal or writes outside the repository,
- symlink handling that can redirect projection writes,
- unsafe cleanup of unmanaged runtime files,
- mutable file overwrite bugs,
- target-output `.harnessIgnore` or `.harnessProfile` preservation failures,
- package publishing or binary execution concerns.

The v1 specification is documented at:

https://www.harnessconfig.dev/specifications/v1/
