# Single-session foundation and architecture ExecPlan

## Goal

Produce one reviewable commit that gives ReproLock a minimal, executable local-functional-QA
foundation and an internally consistent product architecture, without running a real target Spike
or claiming product readiness.

The observable outcome is:

- strict TypeScript, formatter, linter, unit tests, package smoke, and a Chromium loopback smoke all
  pass;
- one versioned terminal-result contract serializes deterministically;
- one bounded atomic evidence writer is verified;
- current repository documentation no longer directs new work toward public bug discovery,
  parallel Mutation/WebMCP spikes, or premature packages; and
- the phase ends with `CONDITIONAL GO` or `NO-GO`, never unconditional `GO`.

## Scope

### Allowed paths

- `AGENTS.md`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- `.github/workflows/ci.yml`
- `playwright.config.ts`
- `src/domain/verdict.ts`
- `src/evidence/canonical-json.ts`, `src/evidence/writer.ts`
- `fixtures/loopback/server.ts`
- `tests/repository-foundation.test.ts`
- `tests/domain/verdict.test.ts`
- `tests/evidence/writer.test.ts`
- `tests/playwright/loopback.spec.ts`
- `README.md`, `CONTRIBUTING.md`, `SECURITY.md`
- `examples/README.md`, `packages/README.md`, `spikes/README.md`, `plans/README.md`
- `docs/foundation/repository-layout.md`
- `docs/foundation/branch-and-worktree-policy.md`
- `docs/adr/0001-runtime-and-toolchain.md`
- `reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md`
- this plan and `harness/context/01-single-session-foundation-and-architecture.md`
- historical Wave 0 records only for a short supersession banner; their evidence remains unchanged

### Explicitly excluded

- old worktrees, old branches, `integration/wave1`, and stash `37728ff`
- a real target repository or functional-regression Spike
- model/provider integration, public target discovery, GitHub integration, WebMCP, mutation tooling,
  dashboards, hosted services, package publication, or a multi-package graph
- production supervisor/compiler/explorer implementation beyond the three executable foundation
  proofs named above
- updates to the central `harness/build-log.md`, which remains integration-owned

## Inputs supplied by the user

- clean-start bundle v2 and its seven individual files
- repository path and historical baseline SHA
- permission to complete the project while preserving the hard local-functional-QA gates
- no target repository, issue snapshot, revisions, start command, or reset command yet

## Baseline

Branch `reprolock/foundation-architecture` starts at
`5585bd54a02796de380956ca25c72f72794793f4`.

| Command | Actual result |
| --- | --- |
| `git status --short --branch` | clean; branch `reprolock/foundation-architecture` |
| `pnpm install --frozen-lockfile` | exit 0; six existing packages installed from the pinned lockfile |
| `pnpm check` | exit 0; format, lint, typecheck, and 3/3 Node tests passed |
| `pnpm package:smoke` | exit 0; package archive smoke passed, 34,553 bytes |

## Milestones

### 1. Deterministic foundation contracts

- Output: terminal result types, canonical JSON, bounded atomic JSON writer, and focused Node tests.
- Verification: format, lint, typecheck, exact-byte serialization test, atomic-write and cleanup
  tests.
- Stop condition: output cannot be deterministic, paths cannot be bounded, or a failed write can
  expose a partial final file.

### 2. Local browser smoke

- Output: one in-process fixture bound to `127.0.0.1`, one Chromium business-state smoke, explicit
  zero retries and one worker.
- Verification: `pnpm exec playwright test` with the pinned Chromium installation.
- Stop condition: the fixture requires an external service, leaves a listener open, or the outcome
  is only visual rather than executable.

### 3. Product architecture and scope reset

- Output: current docs define exact inputs/outputs, result taxonomy, lifecycle, reset, timeouts,
  cancellation, evidence, standalone compilation, CLI exit codes, first value, gates, and kill
  criteria. Pre-v2 records remain preserved but are marked historical.
- Verification: review every current-scope doc for public-target, Mutation/WebMCP, hidden retry,
  model-replay, and premature-package claims.
- Stop condition: any P0 contract remains contradictory or a document treats old Wave 1 evidence
  as authorization for current implementation.

### 4. Verification and handoff

- Output: exact command results, changed paths, limitations, final verdict, one coherent commit.
- Verification: frozen install, browser installation, full checks, package smoke, diff review,
  ownership check, and clean final status.
- Stop condition: unexplained instability, unrelated changes, or a required check does not run.

## Decisions

- Keep one root TypeScript application. Logical modules do not become packages until independent
  release cycles or consumers exist.
- Foundation code is a contract proof, not production implementation and not product Gate evidence.
- Use `@playwright/test` only for the explicit local smoke requirement; no model or provider SDK is
  introduced.
- Preserve arrays in semantic order and sort object keys for canonical JSON. Reject unsupported
  JavaScript values instead of guessing.
- Emit canonical object members directly rather than relying on JavaScript object enumeration;
  this preserves lexical ordering for integer-like keys and treats `__proto__` as data.
- Parse persisted paths with a host-independent `/`-only grammar before filesystem work. Reject
  traversal, Windows ADS/device aliases, invalid characters, and cross-platform reinterpretation.
- Atomic writes use a same-directory temporary file, flush/close, no-overwrite hard-link
  publication, and mandatory temporary cleanup. Cleanup failure is visible as an operational
  error. This phase does not claim power-loss durability or filesystems without local hard-link
  support.
- Cache one fixture close promise, destroy tracked active sockets, and fail after a bounded cleanup
  deadline so concurrent cancellation cannot report success while cleanup is still running.
- No automatic retries. Repetition is represented as visible independent attempts after verified
  reset.
- Keep old Wave 0 evidence text intact where possible and mark superseded scope rather than
  rewriting history.

## Security and privacy

- The browser fixture uses synthetic data and loopback only.
- Evidence paths are repository-relative or output-root-relative; no machine-specific path is
  persisted.
- The writer rejects absolute paths and traversal outside its explicit output root.
- No issue/page/model text is executed as a command.
- No cookies, credentials, accounts, hosted applications, production data, or network capture are
  involved.

## Progress

- [x] Establish exact clean-start baseline.
- [x] Create isolated named worktree and branch.
- [x] Record pre-edit baseline.
- [x] Implement deterministic contracts and tests.
- [x] Add loopback Playwright smoke and CI support.
- [x] Reconcile current scope and architecture docs.
- [x] Run final verification and update the phase context; create the phase commit and stop.

## Observed failures and corrections

- The first writer golden used a manually copied SHA-256 and failed 1 of 9 tests. The expected hash
  was corrected to the independently computed bytes; subsequent runs passed.
- The first active-socket cleanup smoke observed the expected forced `ECONNRESET`, but
  `events.once(socket, "close")` converted the preceding error event into a test rejection. The
  test now handles the socket error and waits explicitly for `close`; the cleanup remains bounded.
- Independent review found integer-like key reordering, `__proto__` loss, non-portable path forms,
  hidden array properties, and an unbounded active connection. Each received a focused regression
  test before the final full check.

## Evidence

- Durable command and result summary: `harness/context/01-single-session-foundation-and-architecture.md`
- Executable acceptance: `tests/domain/`, `tests/evidence/`, and `tests/playwright/`
- Product architecture: `reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md`

## Completion gate

`CONDITIONAL GO` requires every foundation check to pass and every P0 architecture decision to be
explicit. The remaining condition is a future user-supplied local Spike with a verified reset,
independent oracle, one standalone spec, and 20/20 pre-fix FAIL plus 20/20 post-fix PASS.

Missing or unstable foundation evidence produces `NO-GO`. Missing real-Spike inputs do not turn
fixture success into product `GO`.
