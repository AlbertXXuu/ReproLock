# Safe Unfollow #163 local functional-regression Spike A context

## Scope and result

- Current branch: `codex/spike-recovery-20260904` (adopted from `spike/local-functional-regression`)
- Base commit: `83daeeed3b9947fff89cfd7942c3dd0b32fc5475`
- Target: user-supplied `https://github.com/ignromanov/safe-unfollow.git`
- Pre-fix: `64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47`
- Post-fix: `ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa`
- Decision: `SPIKE_CONDITIONAL`; product `GO` not obtained.
- Non-goals preserved: no target changes, external accounts, real exports, hosted targets,
  provider integration, GitHub Action, package/release work, second target, or security work.

## ReproLock baseline

| Command/check | Actual result |
| --- | --- |
| `git rev-parse --show-toplevel` | exact authorized ReproLock worktree |
| `git status --short --branch` | clean detached HEAD |
| `git rev-parse HEAD` | `83daeeed3b9947fff89cfd7942c3dd0b32fc5475` |
| `git branch --show-current` | empty, detached as permitted |
| branch conflict check | `spike/local-functional-regression` absent |
| exact target-path check | absent before clone |
| old worktree/stash inspection | legacy worktrees, `integration/wave1`, and backup stash present and left untouched |

The Spike branch was created only after those checks passed.

## Target provenance and execution

The target was cloned with `git clone --no-checkout` at the exact user-authorized path. Immutable
detached worktrees were then created for each supplied revision. The origin, MIT license,
`package-lock.json` version 3, and direct-parent ancestry were verified without inspecting the
post-fix source or diff. Both worktrees remained clean at their exact commits.

| Command | Actual result |
| --- | --- |
| `git clone --no-checkout https://github.com/ignromanov/safe-unfollow.git <target-control>` | success; origin exact |
| `git worktree add --detach <pre-fix-worktree> 64c8a1d...` | clean detached worktree |
| `git worktree add --detach <post-fix-worktree> ab55329...` | clean detached worktree; created only after freeze |
| `npm ci` in each revision | 900 packages installed; identical lockfile hash |
| `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort` | Vite 7.3.1 bound to the authorized loopback origin |
| readiness `GET /upload` | HTTP 200 before browser execution |

Observed environment: Windows x64 `10.0.26200`, Node.js `22.23.2`, npm `10.9.8`, pnpm
`11.19.0`, Playwright `1.62.1`, and Chromium `151.0.7922.34`. The target declared no Node engine
range. Both installs reported the same 22 dependency audit findings; they were recorded but not
investigated because this was a functional, not security, Spike.

## Blind discovery and freeze

Only the pre-fix worktree and runtime were inspected during discovery. A minimal synthetic
persisted fixture was established for `unfollow-radar-store`, schema version 5, with
`uploadStatus: "loading"`. The authoritative evidence remained the rehydrated UI, not storage.

The first reset design cleared storage while the application was live. The application repopulated
it immediately, so that attempt was correctly classified as `reset-error`, not as a functional
failure. The final reset opens same-origin `/robots.txt`, clears and verifies origin state, seeds
the synthetic fixture, and then navigates to `/upload` in a fresh context.

The candidate then reproduced the expected pre-fix failure at the first functional checkpoint,
`processing-cleared`, because `Analyzing locally...` remained visible. Before any post-fix
worktree/source inspection, nine hypothesis files were frozen at
`2026-09-01T10:47:50.405Z`. The standalone spec SHA-256 was
`d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad`; all frozen hashes were
independently recomputed and matched.

The first unchanged post-fix execution passed. Only then was the diff read. It confirmed that the
fix normalizes an impossible rehydrated `loading` state back to `idle`; the frozen test never uses
the separately added cancel control.

## Differential, minimization, and baseline

| Gate | Pre-fix | Post-fix | Retries | Model calls |
| --- | ---: | ---: | ---: | ---: |
| Frozen test, repeated | 20/20 expected `processing-cleared` functional failures | 20/20 passes | 0 | 0 |
| Honest recorder-style baseline | 20/20 expected visible-spinner failures | 20/20 passes | 0 | 0 |

Every attempt used a new browser context. Raw JSON reporters stayed under ignored local output;
normalized attempts and summaries remove absolute paths.

The candidate contains two navigation actions. The first is required to obtain a verified,
script-free reset origin. Removing the second navigation left both revisions on `/robots.txt`,
made the upload outcome unobservable, and produced `inconclusive` on both sides. Final count:
2 of 2 navigation actions retained.

The honest baseline uses the same synthetic precondition, browser, viewport, two navigations, and
four user-visible assertions. It reached the same differential and stability. The generated test
adds a verified reset postcondition, accessible locators, stable checkpoint identity, an external
outcome contract, and inspectable evidence, but does not reduce action count or improve observed
stability. This limited incremental value is the reason for `SPIKE_CONDITIONAL`.

## Visible corrections

- A PowerShell-unquoted `^{commit}` expression was parsed incorrectly; the immutable revisions
  were rechecked using quoted expressions.
- PowerShell's JSON converter rejected an empty lockfile property; lockfile version was read
  without modifying the file.
- The first candidate attempt exposed a live-app storage race and was retained as `reset-error`;
  reset moved to the same-origin script-free resource before freeze.
- The generated TypeScript project initially omitted DOM libraries; its dedicated configuration
  was corrected before freeze.
- The first baseline attempt referenced a Node constant from the browser execution context; the
  fixture was passed explicitly and the baseline was typechecked and rerun.
- The replay wrapper initially accepted an arbitrary `TARGET_BASE_URL`; it now rejects anything
  except the exact HTTP loopback origin before readiness or browser execution.

## Evidence and verification

Committed evidence is rooted at `spikes/local-functional-regression/`. The principal files are:

- `generated/safe-unfollow-163.spec.ts` and its frozen metadata;
- `outcome-contract.json`, `reset-protocol.json`, `candidate-trace.json`, and
  `minimization-log.json`;
- `attempts.jsonl`, `differential-summary.json`, `replay-summary.json`, and
  `baseline/recorder-comparison.json`;
- `manifest.json`, verified by the evidence CLI;
- `SPIKE_REPORT.md`, which contains the full decision and limitations.

| Final command/check | Exit/result | Observable evidence |
| --- | --- | --- |
| evidence CLI `materialize` over the four local raw reports | 0 | wrote `attempts.jsonl` and three summaries after strict report binding |
| evidence CLI `manifest` | 0 | 26 SHA-256 entries; `manifest.json` excludes itself |
| evidence CLI `verify` | 0 | `ok: true`, zero issues |
| `pnpm check` | 0 | format/lint/root typecheck; unit 23/23; loopback browser 1/1 |
| generated and baseline dedicated `tsc --noEmit` | 0 each | both standalone Playwright projects typecheck |
| post-fix replay wrapper, repeat 1 | 0 | readiness HTTP 200; generated test 1/1 passed |
| replay wrapper with `TARGET_BASE_URL=https://example.com` | 1 expected | rejected before readiness access; exact loopback origin required |
| frozen generated-spec SHA-256 recheck | match | `d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad` |
| `pnpm package:smoke` | 0 | private archive smoke passed at 86,371 bytes |
| `git diff --check` | 0 | no whitespace errors |

The replay server was then stopped and port 4173 was released.

## Risks and stable handoff

- The supplied issue already exposed the interrupted-state concept and likely status value, so
  this case required less discovery than a typical unstructured report.
- The reset fixture is stable but coupled to the target's storage key/schema.
- One Windows/Chromium case cannot justify broad product claims.
- The control clone created with `--no-checkout` has an empty index that reports default-branch
  files as deleted. The two tested detached worktrees are clean and authoritative; the control
  clone must not be described as clean.
- A second, less-structured user-supplied case must require genuine outcome/workflow discovery and
  show clearer maintainability or effort value over an honest baseline before the conditional can
  be removed.

All owned servers were stopped and port 4173 was released. Browser contexts closed in `finally`;
no screenshots, video, traces, cookies, credentials, personal data, or real Instagram exports were
persisted. Revision worktrees remain locally available, clean, and unmodified for reproducibility.

Final decision: `SPIKE_CONDITIONAL`. Product `GO`: not obtained.

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

## Verified source delivery — 2026-09-04

- Source commit: [bfc2d521631b1bb69a0bf83a1a512a213cf97211](https://github.com/AlbertXXuu/ReproLock/commit/bfc2d521631b1bb69a0bf83a1a512a213cf97211).
- Private source PR: [ReproLock #1](https://github.com/AlbertXXuu/ReproLock/pull/1).
- Source CI: [run 33867375012](https://github.com/AlbertXXuu/ReproLock/actions/runs/33867375012),
  completed SUCCESS on that exact source SHA. Both Ubuntu jobs, Node 22.23.2 and 24.20.0,
  passed 28/28 unit tests, 1/1 browser test, standalone typechecks, evidence verification and archive
  content smoke (78 files, 102686 bytes).
- Historical main was pushed unchanged at 18b83c0b2892c7d93caaa863f26fbc9c861ae4ac; its
  [initial CI](https://github.com/AlbertXXuu/ReproLock/actions/runs/33867302013) also passed.
- `git ls-remote --heads origin main codex/spike-recovery-20260904` matched both local refs.
  Git initially encountered schannel/OpenSSL TLS handshake failures; per-command OpenSSL plus
  HTTP/1.1 succeeded with certificate verification still enabled. No force-push or history rewrite.
- `gh pr view` reported MERGEABLE / CLEAN for the verified source commit. This documentation
  follow-up does not change executable sources or the evidence bundle; the current
  [PR checks](https://github.com/AlbertXXuu/ReproLock/pull/1/checks) are authoritative for its own CI.

The working tree was clean after the source commit. The D-drive main checkout remains the preserved
historical entry point until a separately reviewed integration; current work is on the task branch.
No PR merge, package/Release publication, public-visibility change, website deployment, second target
or production stage was performed. The remaining product decision is still SPIKE_CONDITIONAL.
