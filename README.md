# ReproLock

ReproLock turns a user-supplied functional bug description or recorded browser workflow into an
independently checked, minimized, standalone Playwright regression test.

## Status

ReproLock is an unpublished local-functional-QA project. The repository has a locally verified
engineering foundation and an architecture suitable for one user-supplied Spike. It has **not** passed the
product Gate: no real local target has yet demonstrated the same generated test failing 20/20 on a
known pre-fix revision and passing 20/20 on a known post-fix revision.

The current decision is therefore `CONDITIONAL GO` for foundation and architecture only. Product
implementation beyond the bounded Spike remains gated.

## Product contract

- A model may propose actions; it never decides whether the outcome succeeded.
- Independent executable oracles produce `pass`, `fail`, or `inconclusive`.
- Operational `error`, `cancelled`, and `policy_denied` results remain distinct from functional
  outcomes.
- Replay and ordinary CI do not call a model.
- Generated tests are ordinary readable Playwright tests without a ReproLock runtime import.
- Every attempt starts from an explicit, verified reset; there are no hidden retries.
- Evidence is versioned, canonical, hashable, bounded to an output root, and data-minimized.
- The first failed checkpoint locates the observed difference; it is not a root-cause claim.

Read [PROJECT_CHARTER.md](PROJECT_CHARTER.md) for product scope and
[the architecture baseline](reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md) for executable
contracts and gates.

## Development

The pinned package manager is pnpm `11.19.0`. Node.js `24.20.0` is the primary runtime and
`22.23.2` is the minimum declared runtime.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm package:smoke
```

`pnpm check` runs formatting, lint, strict typechecking, deterministic unit/integration tests, and
one Chromium smoke against an ephemeral `127.0.0.1` fixture with zero retries.

## Current repository map

- `src/domain/` — deterministic terminal-result contracts.
- `src/evidence/` — canonical JSON and bounded atomic evidence writing.
- `fixtures/loopback/` — synthetic loopback-only acceptance fixture.
- `tests/domain/`, `tests/evidence/`, `tests/playwright/` — executable foundation evidence.
- `reference/` — current architecture and acceptance baseline.
- `docs/foundation/` — repository layout and sequential worktree policy.
- `plans/` and `harness/context/` — phase-local execution and evidence records.
- `examples/`, `packages/`, and `spikes/` — admission policies, not prebuilt product surfaces.

Historical Wave 0 records are preserved for auditability but do not authorize the old parallel
public-target, Mutation, or WebMCP route. Old branches, worktrees, and stash objects are history,
not completion evidence for the current scope.

## Next Gate

The user must supply:

```text
TARGET_REPOSITORY_PATH
ISSUE_SNAPSHOT_PATH
PRE_FIX_REVISION
POST_FIX_REVISION
START_COMMAND
RESET_COMMAND
```

The Spike must remain local and loopback-only, prove the baseline differential first, define an
independent outcome contract, preserve all attempts, minimize actions, emit one standalone test,
and obtain stable 20/20 results on each revision. Missing inputs prevent the Spike from starting;
an individual accepted check may be `inconclusive`, while an absent contract, reset, differential,
or unresolved variation makes the overall Spike `NO-GO`.
