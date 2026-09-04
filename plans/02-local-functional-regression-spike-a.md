# Safe Unfollow #163 local functional-regression Spike A

## Goal

Produce one independently checked, standalone Playwright regression test that fails for the
expected user-visible reason on Safe Unfollow commit
`64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47`, passes unchanged on
`ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa`, and repeats that differential for 20 fresh browser
contexts per revision with zero retries and zero model calls during replay.

## Scope

### Allowed paths

- `plans/02-local-functional-regression-spike-a.md`
- `harness/context/02-local-functional-regression-spike-a.md`
- `spikes/local-functional-regression/**`
- the exact user-authorized clone and disposable worktrees below, without target source changes
- minimal ReproLock source, tests, and package configuration only when required to verify evidence

### Explicitly excluded

- permanent branches or source changes in the target repository
- hosted deployments, external accounts, Instagram exports, public target discovery, security work
- legacy ReproLock branches, worktrees, `integration/wave1`, and the backup stash
- provider integration, production implementation, GitHub Action, Mutation, WebMCP, release work,
  another target, or a product `GO` claim

## Trusted user inputs

- target: `https://github.com/ignromanov/safe-unfollow.git`
- local clone: non-portable execution-only path supplied by the user
- issue snapshot: `spikes/local-functional-regression/inputs/safe-unfollow-163.md`
- pre-fix: `64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47`
- post-fix: `ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa`
- install: `npm ci`
- start: `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`
- readiness: `http://127.0.0.1:4173/upload`
- reset: fresh browser context, clear all origin storage, seed only the minimum versioned local
  state, reload `/upload`, close the context; no server-side state

## Baseline

| Command | Actual result |
| --- | --- |
| `git rev-parse --show-toplevel` | exact authorized ReproLock worktree |
| `git status --short --branch` | clean detached HEAD |
| `git rev-parse HEAD` | `83daeeed3b9947fff89cfd7942c3dd0b32fc5475` |
| `git branch --show-current` | empty, detached as permitted |
| branch conflict check | `spike/local-functional-regression` absent |
| target path check | exact supplied clone path absent |
| `Get-Command npx` | available from the installed Node.js runtime |

The branch `spike/local-functional-regression` was created from the exact baseline only after all
checks passed.

## Milestones

### 1. Provenance and isolation

- Clone or validate only the supplied repository, verify origin/license/lockfile/runtime and both
  immutable objects, and create disposable revision worktrees.
- Confirm ancestry without opening the post-fix diff.
- Stop on path, provenance, revision, license, or scope mismatch.

### 2. Pre-fix-only reproduction and oracle

- Install from the committed lockfile, bind only to `127.0.0.1:4173`, discover the minimum
  persisted fixture, and reproduce the stuck upload page.
- Define semantic checkpoints and preserve the first failed checkpoint.
- Stop with evidence-backed `NO_GO` if the declared behavior cannot be reproduced or observed.

### 3. Blind freeze

- Before evaluating post-fix, write the standalone test, outcome contract, reset protocol,
  candidate sequence, minimization baseline, and hashes.
- Later assertion corrections remain visible decisions; frozen artifacts are never silently
  replaced.

### 4. Differential, minimization, and baseline comparison

- Execute the identical frozen test on post-fix before inspecting its diff.
- Minimize by deletion trials with a verified reset and compare honestly with a straightforward
  recorder/codegen-style test.
- Stop if one unchanged test cannot represent the differential.

### 5. Repetition and evidence

- Run 20 independent pre-fix and 20 independent post-fix attempts with zero retries.
- Persist deterministic, versioned, data-minimized attempt and summary artifacts plus a SHA-256
  manifest.
- Variation or unresolved inconclusive attempts make the overall decision `NO_GO`.

### 6. Verification, review, commit, and cleanup

- Run formatter, lint, strict typecheck, focused/unit/browser checks, generated-test typecheck and
  execution, evidence verification, `git diff --check`, and package smoke only if packaged paths
  change.
- Inspect every changed file, ensure no target file or large artifact is staged, commit once, stop
  all owned processes, and report target clone/worktree cleanup state.

## Decisions

- The blind boundary is the first post-fix execution: no post-fix source or diff is read before
  the candidate test and contract are hashed.
- The user-visible rehydrated UI is authoritative; localStorage is only a controlled precondition.
- A model adapter is omitted unless evidence demonstrates a current need. Replay remains model-free.
- Screenshots, video, traces, real accounts, and real Instagram data are unnecessary and excluded.
- All committed paths and target identifiers are portable; absolute clone paths stay in local-only
  command logs and the final conversational report.

## Security, privacy, and cleanup

- Only synthetic browser storage and the loopback target are used.
- Every process has bounded readiness/execution/cleanup handling, and every browser attempt closes
  its own new context.
- No cookies, credentials, personal data, auth values, or unrelated paths enter committed evidence.
- Target worktrees are disposable and never patched; failed attempts remain visible.

## Progress

- [x] Repeat ReproLock baseline and branch-conflict checks.
- [x] Create `spike/local-functional-regression` from the exact foundation commit.
- [x] Persist the user-supplied issue snapshot.
- [x] Validate target provenance and revision ancestry.
- [x] Reproduce and characterize pre-fix behavior.
- [x] Freeze and hash the candidate test and contracts.
- [x] Evaluate post-fix before reading its diff.
- [x] Minimize and compare the recorder-style baseline.
- [x] Complete 20 + 20 independent attempts.
- [x] Verify evidence and ReproLock checks.
- [x] Stop owned runtime resources and inspect the final scope.
- [x] Commit one coherent Spike result: `bfc2d521631b1bb69a0bf83a1a512a213cf97211`.

## Completion gate

The result is `SPIKE_GO` only if every hard gate and honest comparison passes. It is
`SPIKE_CONDITIONAL` only after the entire stable differential passes while a named non-core
limitation narrows the claim. A missing or unstable differential, oracle, reset, standalone test,
or verified evidence is `NO_GO`. No Spike result grants product `GO`.

## Recovery ownership and acceptance — 2026-09-04

Owner: task 01a06c0b-b7b0-7e52-b68e-b08467a68129, sole writer on
`codex/spike-recovery-20260904`, adopting the existing worktree at base
`83daeeed3b9947fff89cfd7942c3dd0b32fc5475`. The former Spike ref remains unchanged.
Active/archived task inspection found no competing implementation owner; the active AlvenX task
was explaining directory layout, and the original Spike task was inactive. Status remained stable.
Local-only recovery backups retain the complete original index, staged/unstaged binary patches,
worktree list, and original file hashes under the workspace recovery audit directory.

Additional allowed paths for this owner: README.md, package.json, .github/workflows/ci.yml,
scripts/package-smoke.mjs, tests/spike/**, reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md,
and ignored output/**. Existing source and tests may
receive only fixes required by this review. Frozen inputs/spec/config, historical attempts/raw
reports/summaries, targets, old refs and the central build log are preserved. The explicit current
user authorization permits private GitHub source hosting; older exclusions concern product
integration and release, and do not override this request.

Baseline executed on Node 22.23.2/pnpm 11.19.0: format exit 1; lint exit 0 with unused-code
warnings; typecheck exit 0; unit 19/23 (4 failures); evidence verifier exit 1 (8 issues).

Review decisions and acceptance:

- Remove the uncommitted run-envelope layer: hashes sampled during materialization do not prove
  historical runtime provenance. Keep v1 raw-report references and historical bytes; keep stricter
  frozen/core/semantic checks. Verify reports are 20 distinct tests, one result each, explicit retry 0.
- Validate minimization trial content; reject timed-out/interrupted/wrong-state results and prevent
  replacement of differing run artifacts. Test these failures and current bundle verification.
- Bound replay cancellation/process cleanup and reject readiness redirects. Verify normal replay,
  timeout and cancellation against the existing disposable target while keeping frozen source.
- Add current evidence verification and both standalone typechecks to CI. Inspect package archive
  contents; retain its private, unpublished status. Run Node 22/24 checks and archive smoke.
- Re-run the real generated and honest baseline differential under a dated new output directory;
  record contemporaneous clean revisions, source/report hashes, outcomes and cleanup separately.
- Update current README/report status, inspect final scope and hashes, run git diff --check, commit,
  push a private task branch, create PR and follow CI. Product remains SPIKE_CONDITIONAL.

Stop on unverified cleanup/differential, ownership conflict, or unavailable GitHub authorization.
Rollback uses the preserved patches as inspectable recovery data, never reset/clean. Production
scope and a second user-supplied case remain separate decisions after engineering acceptance.

## Recovery completion

- [x] Resolve the evidence/runtime/CI findings and obtain independent final reviews without P1/P2 findings.
- [x] Preserve historical bytes and verify fresh generated/manual 20+20 differentials.
- [x] Verify real cancellation/timeout process cleanup and the full exact Node 22/24 local matrix.
- [x] Create the private source PR and obtain successful CI for the implementation commit.

Exact commands, errors, local results, immutable source SHA and successful CI links are recorded in
[harness/context/02-local-functional-regression-spike-a.md](../harness/context/02-local-functional-regression-spike-a.md).
The containing documentation commit is checked again through PR #1 before delivery. No executable
source or evidence bytes changed in this follow-up. Product SPIKE_CONDITIONAL and N003 scope/value
inputs remain unresolved; source submission does not open the next product gate.

## Authorized integration and fixed entry point — 2026-09-04

The owner subsequently authorized merging this task PR after review and all required CI, updating
the D-drive main checkout, and retiring only audited redundant worktrees through Git/Codex.
This overrides the earlier no-merge/legacy-checkout exclusions for this cleanup only. Historical
refs, stash, target worktrees, original experiment bytes and product gates remain preserved.
Additional documentation ownership covers AGENTS.md and docs/foundation/branch-and-worktree-policy.md.

- [x] Confirm source head 3142ffe2850964faca7def2b0956b65ed2c8e5f9, clean C and D checkouts,
      successful PR CI, and no other active ReproLock writer.
- [x] Archive the complete C checkout except dependencies/Git metadata, all ignored run output,
      original recovery backups, and all Git refs; verify archive hashes and Git bundle.
- [x] Audit all six legacy checkouts and preserve their ignored evidence. Retain issue-to-repro
      because its nested drawdb experiment repository requires separate disposition.
- [x] Record sequential development in the saved D-drive checkout as the default policy.
- [ ] Review this documentation change and wait for both CI jobs on its exact pushed head.
- [ ] Merge PR #1 with an expected-head guard; fast-forward the clean D-drive main to the merge SHA.
- [ ] Run the normal engineering checks in the D-drive checkout and confirm main CI.
- [ ] Retire the five other audited legacy checkouts and the merged C task checkout with
      git worktree remove; preserve branch refs/stash, and record final inventory locally.

Stop on a changed PR head, unsuccessful required check, competing writer, local-only content not
covered by the backups, or a non-fast-forward main. Preserve the checkout on cleanup failure.
Rollback is a reviewed revert or recreation from the retained refs/bundle; never overwrite a
checkout. Actual post-merge results and the final SHA belong to the local handoff audit and delivery
report, avoiding a documentation commit that claims its own unobserved merge or CI result.
