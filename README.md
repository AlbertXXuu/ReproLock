# ReproLock

> Turn a messy browser bug report into a verified, durable Playwright regression test.

**Project status — 2026-09-01:** ReproLock is a provisional working name for an AlvenX
pre-product candidate. The repository is in Wave 0 foundation work, is unpublished, and has not
passed the product Gate. There is no released package or production implementation yet.

## The outcome

ReproLock is intended to turn a GitHub bug report or one successful browser workflow into a
plain Playwright test that remains useful without ReproLock. Agent-assisted exploration may
propose actions and outcomes, but a deterministic oracle must independently confirm the final
business state.

The product contract is evidence-first:

- Agent output is a candidate, never the verdict.
- Final replay and CI do not call an LLM.
- An unobservable or unresettable result is `INCONCLUSIVE`, not confirmed.
- Generated tests are ordinary, readable Playwright tests with no ReproLock runtime import.
- Evidence is versioned, hashable, reviewable, and redacted; failed attempts remain visible.
- The first violated outcome is reported without inventing a root cause.

The complete mission, users, scope, invariants, and release gates live in
[PROJECT_CHARTER.md](PROJECT_CHARTER.md).

## Current Gate

Wave 0 establishes repository governance and a reproducible TypeScript/pnpm toolchain. Wave 1
then tests the product hypothesis with an architecture review and three bounded spikes. Product
implementation may start only when the architecture is at least `CONDITIONAL GO` and Spike A is
`GO`.

Spike A must supply all of the following evidence:

- a public historical issue with identified Bug and Fix commits;
- an independently verified oracle;
- a generated plain Playwright test;
- Bug commit `FAIL` and Fix commit `PASS` in the same controlled environment;
- 20 out of 20 consistent replays;
- no LLM call during replay; and
- no credential disclosure or arbitrary-command path.

If those conditions cannot be demonstrated, the correct result is to stop or revise the product
hypothesis rather than expand the implementation.

## Foundation development

The pinned development runtime is Node.js `24.20.0`; the supported range is
`>=22.23.2 <25`. The package manager is pnpm `11.19.0`. See
[ADR 0001](docs/adr/0001-runtime-and-toolchain.md) for the dated evidence and rationale.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm package:smoke
```

These commands validate the repository foundation; they are not evidence that the product Gate
has passed. Contribution and security procedures are documented in
[CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Repository map

- [`docs/foundation/`](docs/foundation/) — repository layout and branch/worktree rules.
- [`docs/adr/`](docs/adr/) — accepted, reviewable technical decisions.
- [`plans/`](plans/) — ExecPlans for substantial work.
- [`harness/`](harness/) — phase context and evidence-backed build records.
- [`packages/`](packages/) — gated production package area; intentionally empty in Wave 0.
- [`examples/`](examples/) — gated, runnable product examples; intentionally empty in Wave 0.
- [`spikes/`](spikes/) — falsifiable investigations used to decide whether implementation proceeds.

Every Codex task uses its own branch and Git worktree and may modify only its assigned paths. See
[the branch and worktree policy](docs/foundation/branch-and-worktree-policy.md).

## Project relationship

ReproLock belongs to AlvenX and inherits evidence discipline developed through
OpenMultimodalLab, BrowserAgentRegression, and PhysGauge. Those projects remain independent,
stable/maintained projects; ReproLock does not use them as a place to grow its feature surface.

Formal naming, package publication, and any release claim remain reserved until the documented
Gates are satisfied.
