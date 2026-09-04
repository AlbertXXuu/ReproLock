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
- [ ] Commit one coherent Spike result; report the resulting SHA after the self-referential step.

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

## Recovery execution evidence — 2026-09-04

Read-only foundation/evidence reviews identified false runtime binding in the proposed envelope,
duplicate-attempt acceptance, swallowed/contradictory errors, incomplete minimization validation,
missing current-artifact CI checks, unbounded cancellation cleanup and readiness redirects. The
minimal fixes retain one root application and the ordinary frozen Playwright output. No dependency,
provider, production module or target source change was added.

The first repair run caught a missing TypeScript field in the new report-ID parser; it was corrected
before the real replay. All subsequent unit runs passed, reaching 28 tests with the added failure
cases. Current checks use the actual project contract, not changed expected hashes to hide failure.

Fresh differential ran 2026-09-04T11:06:28.235Z through 2026-09-04T11:11:25.132Z, Node v22.23.2,
Windows Chromium. Exact commands used for each supplied detached revision:

```text
git status --porcelain
git rev-parse HEAD
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
node node_modules/@playwright/test/cli.js test --config spikes/local-functional-regression/generated/playwright.config.ts --repeat-each=20 --reporter=json --output <new-run-output>/generated-<side>-artifacts
node node_modules/@playwright/test/cli.js test --config spikes/local-functional-regression/baseline/playwright.config.ts --repeat-each=20 --reporter=json --output <new-run-output>/baseline-<side>-artifacts
node spikes/local-functional-regression/generated/replay-safe-unfollow-163.mjs --repeat 1
```

Each pre-fix CLI exited 1 for twenty expected visible-spinner functional failures; each post-fix
CLI exited 0 for twenty passes. The normal post-fix wrapper exited 0 for one pass. Every report was
then imported through `materializeEvidenceBundle` into a fresh isolated bundle; its manifest and
`verifyEvidenceBundle` returned zero issues. The four derived documents and capture record are
preserved in `spikes/local-functional-regression/revalidation/2026-09-04/`. Original raw files
remain in `output/spike-safe-unfollow-163/raw/`; new raw files, process-test logs and full local
execution record remain in `output/recovery-20260904/`. These local raw logs are ignored because
Playwright includes machine paths. Committed summaries contain only relative paths and hashes.

Cancellation check invoked exported `replay({repeat:20, signal, timeoutMs:20000})` with an
AbortController aborted after 5000 ms. Timeout check used `replay({repeat:20, timeoutMs:5000})`.
For each, Windows CIM process snapshots observed the wrapper/runner/browser descendants before
termination and checked all observed IDs after completion: 7 observed, 0 survivors, results
`cancelled/130` and `timeout/124`. No other task's process was terminated. Target services were
separately stopped using only their owned PID trees; both clean detached revisions were retained.

Next phase assessment: N002 engineering recovery can proceed to source PR review; N003 production
scope remains blocked by product-value evidence and owner scope/case selection. The existing case
already supplies target/issue/revisions/start/reset; README no longer asks for its first inputs.
Successful source submission, CI, and archive inspection do not satisfy product GO or publication.

## Final local engineering acceptance — 2026-09-04

Both exact runtimes, Node 22.23.2 and Node 24.20.0, executed pinned pnpm 11.19.0 with the selected
Node directory first on PATH. No dependency versions or lockfile changed. The bundled fallback
shim uses its own Node, so the matrix explicitly invoked the installed pinned pnpm entry point.

| Command | Node 22.23.2 | Node 24.20.0 |
| --- | --- | --- |
| `pnpm install --offline --frozen-lockfile` | exit 0 | exit 0 |
| `pnpm exec node --version` | v22.23.2 | v24.20.0 |
| `pnpm check` | exit 0 | exit 0 |
| format/lint/root typecheck within check | pass, no lint warnings | pass, no lint warnings |
| `pnpm typecheck:standalone` within check | both projects pass | both projects pass |
| unit tests within check | 28/28 pass | 28/28 pass |
| Chromium loopback test within check | 1/1 pass | 1/1 pass |
| `pnpm evidence:verify` within check | zero issues | zero issues |
| `pnpm package:smoke` | exit 0, 78 files | exit 0, 78 files |
| `git diff --check` and `git diff --cached --check` | exit 0 | exit 0 |

Archive content smoke verified relative paths, excluded local state and private 0.0.0 metadata;
the matrix archive was 101790 bytes before this final documentation entry. Installability or
publication is not claimed. A harmless inherited NO_COLOR/FORCE_COLOR warning appeared in the
browser runner; it did not change retries or outcomes.

Independent SHA-256 comparison preserved 18 historical files, including all nine frozen
hypothesis inputs, the original forty attempts and three summaries, and all original local Spike
raw/failed-attempt evidence. The archived original manifest also matches its pre-recovery bytes.
The current manifest has 32 entries. No target source, old branch, stash, main checkout or central
build log was changed. The source PR includes only the current v2 foundation history plus this
reviewed Spike recovery; old parallel Wave 1 work is excluded.

Private hosting: authenticated account AlbertXXuu, immutable account ID 204706285. Authenticated
repository listing found no case-insensitive ReproLock match before creation. The new repository
is `https://github.com/AlbertXXuu/ReproLock`, verified PRIVATE, and origin is set to that URL.
Sandbox-only gh returned 401; accessing the existing Windows credential store outside the sandbox
worked without copying or exposing a token. Source push/PR/CI follow this verified local gate;
their immutable commit and run links are recorded in the delivery follow-up.
