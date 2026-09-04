# Local differential verification — execution plan

Owner authorization: 2026-09-05 conversation, following the public-readiness audit and the
proposal to accept a supplied local repository, two revisions and a candidate Playwright test.
Product decision remains `SPIKE_CONDITIONAL`; this is a bounded value-validation increment.

## Baseline and ownership

- Saved D-drive checkout, sole writer in this task, branch `codex/local-differential-verifier`.
- Base `5b13e23bfda5ffc954c77c9bfbe7a4f35f7d75e2`; initial status clean. The other active
  AlvenX task is working on AlvenXWebsite. Read-only reviewers own no source paths.
- Prior independent archive checks: 80/80 unit/process, 4/4 browser, evidence and package pass;
  latest base Node 22/24 CI passed. The base differs from the audited core only by header CSS.
- Preserved cancellation reproducer run on 2026-09-05: direct cancel not applied; first HTTP
  trial returned start/cancel 202 while controller absent. Reproduce against current source with
  a regression test before fixing; preserve old reproducer and all historical runs.

## Writable scope

`src/demo/run.ts`, focused lifecycle tests; new `src/verify/` and `tests/verify/` only for the
approved narrow caller; one small disposable fixture/example; package scripts; setup/usage docs,
README, CONTRIBUTING and the charter's current-experiment clarification, this plan and
`harness/context/04-local-differential-verifier.md` and integration build log. `src/demo/process.ts`
may accept an explicit non-inheriting environment for the new caller, preserving its Demo default.
No historical Spike bytes, recorded exports, brand assets, other projects, old worktrees, or
unrelated user files. Local fresh evidence goes under ignored output; no overwrites.

## Ordered work and acceptance

1. Add a failing early-cancel regression. Latch cancellation synchronously, including shutdown;
   verify no unstarted attempts, truthful terminal state and repeated cancellation safety.
2. Implement the smallest explicit-config local candidate verifier. Reuse process ownership and
   canonical writers. Bind clean exact target revisions and frozen candidate bytes; separate
   reset, business assertion failure, infrastructure error and inconclusive outcomes. Use trusted
   configured commands, loopback readiness, zero retries, bounded time/output and owned cleanup.
   Preserve inspectable per-run evidence and independently recompute the differential gate.
3. Exercise the real CLI against disposable revisioned fixtures and negative controls. A fixture
   is engineering acceptance, never the second real product case or a measured human baseline.
4. Improve ordinary-terminal setup, complete target preparation and external-reader quickstart.
   Keep English product documentation/UI. No visual changes planned.
5. Locate already supplied material for the second, less structured real case. If absent, request
   the repository, immutable issue and pre/post revisions while finishing all unblocked work.
   Pre-register total human setup/review/edit time and later maintenance comparison; do not invent
   timings, independent participants or adoption. No external messages without authorization.
6. Independent review, targeted regressions, complete checks, parent brand/workspace checks,
   package archive and independent install/CLI smoke. Commit, push, PR, follow CI, merge after
   all required checks, return D checkout to verified main as previously authorized.

## Completion and limits

Report exact checks, run artifacts, commit/PR/CI and remaining product inputs. Source integration
does not grant product GO or change GitHub visibility. The public switch is a separate reviewed
decision after the public-readiness items are complete. No npm publication or new provider work.

## Progress and decisions

- Current-source `node --test tests/demo/run.test.ts` first failed with actual `startup-error`
  versus expected `cancelled`; it passed after synchronously creating the abort controller.
- Two successive real `node --test tests/verify/cli.test.ts` executions passed against disposable
  committed Node fixtures, using actual Chromium. Negative controls include ordinary thrown marker
  text, browser closure, refreshed report hashes with contradictory records, and a deadline.
- Read-only review found missing partial-attempt retention and source/target bindings; both were
  added before broad acceptance. Native `toBe` scalar comparison, one outcome assertion/callsite,
  and reviewed reset keep the first caller bounded; locator failures remain inconclusive.
- The pinned TypeScript 7 package exposes no former compiler parser API. Candidate static imports
  are parsed without evaluation using Node's VM module parser and native TypeScript stripping;
  no parser dependency was added. Trusted candidate review remains required.
- Second-case input: owner conditionally selected the existing DrawDB candidate on 2026-09-05,
  subject to provenance and fit checks. A read-only/source reviewer owns a separate fresh local
  experiment directory for pre-only investigation; no ReproLock source or historical bytes there
  are modified. Record public-source selection and prior title hints honestly.
- Current implementation passed 82/82 unit/process checks and 4/4 browser checks; the expanded
  real CLI regression separately passed cancellation after a completed attempt, preserved partial
  observations, verified cleanup and dirty-target rejection. Parent brand/workspace checks passed.
  Independent source and documentation review found no remaining submission blocker.
