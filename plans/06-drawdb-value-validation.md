# DrawDB candidate-verification experiment

## Goal and authorization

Test whether the local candidate-verification workflow executes a second supplied/selected case
without case-specific runtime changes, and document the ordinary Playwright comparison honestly.
The owner selected the existing local DrawDB candidate on 2026-09-05 conditional on provenance and
fit. Official repository, Issue #687, PR #692 and local AGPL-3.0 license were verified. The case is
local browser navigation with synthetic tables, no account or real user data.

## Scope and ownership

Saved D checkout, sole writer, branch `codex/drawdb-value-validation`, base main `9f9277e`.
Allowed: this plan, matching phase context, `spikes/local-candidate-verification/drawdb-687/`,
focused recorded-evidence acceptance, README/current handoff updates and standalone typecheck.
No modifications to old Spike records, fixed Demo exports, unrelated UI, external app source or
historical worktrees. Fresh target worktrees and private raw reports live under the separately
owned local experiment directory; root integrates only inspected portable derivatives.

## Inputs and pre-only evidence

- Official origin: `https://github.com/drawdb-io/drawdb.git`.
- pre: `da0f084d47cd5cb4992df6d3a23707543338e796`.
- post: `9df18ecc272caf5c2368fc305ae40788103fd0d0` (direct child).
- Existing package scripts: `vite build`, `vite preview`; installed Node entry starts preview with
  `--host 127.0.0.1 --port 4175 --strictPort` after the locked build.
- Known hints: official issue and PR prose, including an implementation excerpt, were read before
  freeze. This is a reused candidate with new execution, not a strict blind or independent-human
  discovery experiment. No post source/diff was inspected before the declared candidate freeze.
- V1 pre qualification exposed the symptom but used a fixed 750 ms wait. Preserve it. V2 waits for
  real empty-diagram and save-complete UI, then an observed popstate; event timeout rejects before
  outcome assertion. V2 pre produced a native scalar difference `/editor` versus expected `/`.
- A format-only derivative passed strict TypeScript, SHA-256
  `2d7fbfcf5701625050aec23491e3beb8746641c27bcd6326446cea73871aa9f2`.
  Requalify on pre and record a new freeze before the formal post experiment.

## Method and stop conditions

1. Freeze the reviewed candidate and declared execution parameters before formal comparison:
   Chromium headless, viewport 1280x720, one test/worker, zero retries, 20 repetitions per side,
   20-second test timeout, no screenshots/traces/video during measured execution.
2. Execute the new verifier unchanged against exact clean pre/post worktrees. Persist source/target
   bindings, all attempts, cleanup and independent gate output. An unexpected pre pass, post fail,
   reset/save/event error, missing observation or unknown cleanup blocks differential confirmation.
3. Run the same frozen candidate under ordinary Playwright on each version with matching functional
   coverage and settings. Shared local supervision only supplies bounded process cleanup and
   measurement; the test imports no ReproLock code. Preserve built-in JSON reports and derive
   minimal inspectable per-attempt records, retaining raw hashes and failure history.
4. Report counts, actual agent-operation and execution duration, setup/corrections and measurement
   limitations. No claim of saved human effort, independent usability, reduced maintenance cost or
   adoption without those observations. Repetition tests do not establish general reliability.
5. Inspect portable files for private paths/values; typecheck candidate, verify recorded comparisons
   in CI, perform independent evidence review, then authorized commit/PR/CI/merge and D-main sync.

The product remains `SPIKE_CONDITIONAL`. Preserve both target worktrees while the runnable example
depends on them; old historical worktrees are not cleaned as a side effect of this experiment.

## Completion record

Completed on 2026-09-05. A first 20+20 verifier run correctly observed the differential but was
excluded because the served `dist` bytes were not frozen before execution and post cleanup was
unknown. After freezing the full 28-file build inventory per revision, the formal verifier run
confirmed 20/20 pre-fix functional failures and 20/20 post-fix passes with verified cleanup. The
ordinary Playwright control reproduced the same 20/20 + 20/20 result. Candidate, revisions, served
builds and target fingerprints remained unchanged throughout the formal arms.

The second case supports the verifier's cross-case engineering behavior. It does not demonstrate
incremental authoring or maintenance value: the control was equally stable, the candidate was
agent-authored with known PR hints, and no independent maintainer or human-effort comparison exists.
Keep `SPIKE_CONDITIONAL`; the next product gate is a real maintainer adoption/retention experiment,
not more internal repetitions or UI scope.
