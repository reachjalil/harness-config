## Active Profile: Specification Development

Stay focused on the contract. Use this profile when deciding what
HarnessConfig should mean before implementation work begins.

Scope:

- `docs/STANDARD.md` for normative repository shape and activation behavior.
- `docs/CONFORMANCE.md` for externally testable support claims.
- `docs/TOOLING.md` for CLI-facing behavior only after the standard contract is
  clear.
- `docs/TESTING.md` for required scenario coverage.
- `content/spec/**` for the repository-owned website-ready specification
  source.

Boundary:

- Do not implement CLI behavior in this profile unless the user explicitly
  requests a coupled change. Prefer producing the contract and test
  expectations first, then switch to `cli-development`.
- Keep `docs/STANDARD.md` implementation-neutral. Do not mention internal
  function names, package names, command flags, or local shortcuts there.
- If a wording change implies implementation work, call out the required CLI
  follow-up instead of hiding it in the spec edit.

Testing and review requirements:

- Every new or sharpened normative rule needs a testable scenario in
  `docs/TESTING.md`.
- Every new support claim needs corresponding language in `docs/CONFORMANCE.md`.
- For docs-only standard work, run at least `pnpm run lint`,
  `pnpm --filter @harnessconfig/core test -- docs.test.ts`, and
  `pnpm run check`.
- Run `pnpm run quality` when the specification change touches behavior that
  should already be implemented or verified by existing tests.

