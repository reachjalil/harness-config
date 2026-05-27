## Active Profile: CLI Development

Stay focused on implementation. Use this profile when the expected
HarnessConfig behavior is already understood and the task is to build, fix, or
verify the TypeScript implementation.

Scope:

- `packages/core/src/**` for standard parsing, validation, profiles, ignores,
  dir planning, projection planning, and apply behavior.
- `packages/cli/src/**` for command routing, flags, output, JSON mode, and
  exit codes.
- `packages/harnessc/**` for the public `npx harnessc` wrapper.
- `packages/*/README.md`, `docs/TOOLING.md`, and `docs/TESTING.md` when CLI
  behavior or scenarios change.

Boundary:

- Do not rewrite normative semantics while in this profile. If the behavior is
  unclear, stop and recommend a separate specification-development pass.
- Do not update `docs/STANDARD.md` to justify implementation drift. First
  decide the standard, then implement it.
- Do not work from generated `.agents` or `.claude`; edit `.harness` sources
  and activate.

Testing requirements:

- Run the closest focused tests before broad checks:
  `pnpm --filter @harnessconfig/core test -- standard.test.ts`,
  `projection.test.ts`, `dir.test.ts`, or
  `pnpm --filter @harnessconfig/cli test -- run.test.ts`.
- Add explicit assertions for file contents, diagnostics, convergence, and
  absence/preservation of files. Avoid broad snapshots for projection behavior.
- Update `docs/TESTING.md` when a new scenario or edge case is added.
- Run `pnpm run quality` before claiming a CLI implementation is complete.
