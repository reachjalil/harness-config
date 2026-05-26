## Work Mode Boundary

Do not combine specification design and CLI implementation in one pass unless
the user explicitly asks for a coupled change. Prefer two deliberate efforts:

1. Specification work: decide the contract, conformance claim, and testing
   scenario first.
2. CLI work: implement the already-decided contract and prove it with focused
   tests.

When both are needed, recommend starting with the specification profile,
recording the expected behavior, then switching to the CLI profile for
implementation. This keeps design tradeoffs visible and prevents tests from
being shaped around an accidental implementation.

Local profile selection is intentionally not committed. To focus the agent,
write one profile name to `.harnessProfile`, activate, and keep the task inside
that boundary:

```bash
printf 'specification-development\n' > .harnessProfile
npx harnessc activate --yes

printf 'cli-development\n' > .harnessProfile
npx harnessc activate --yes
```

Remove `.harnessProfile` and activate again to return to the neutral guide.

