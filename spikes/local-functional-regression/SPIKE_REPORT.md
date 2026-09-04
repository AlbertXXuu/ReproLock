# Safe Unfollow #163 local functional-regression Spike A

## Decision

**`SPIKE_CONDITIONAL`**

The hard functional gates passed: one frozen standalone Playwright test fails for the expected
user-visible reason on the supplied pre-fix revision, passes unchanged on the supplied post-fix
revision, and repeats that differential for 20 independent attempts per revision with zero
retries and zero model calls during replay.

The result is conditional because this Issue is unusually detailed, deterministic storage seeding
substantially reduces exploration difficulty, and an honest recorder-style/manual baseline reaches
the same two-action differential and 20/20 stability. ReproLock adds an explicit outcome contract,
verified reset, accessible locators, stable checkpoint failure identity, frozen-hypothesis evidence,
and a verifiable manifest, but the incremental benefit in this case is limited.

**Product `GO` has not been obtained.** This is one external calibration case, not evidence for
broad product claims, production implementation, v0.x, or v1.0.

## Target and provenance

| Field | Verified value |
| --- | --- |
| Repository | `https://github.com/ignromanov/safe-unfollow.git` |
| License | MIT |
| Package manager | npm |
| Lockfile | `package-lock.json`, lockfile version 3 |
| Pre-fix | `64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47` |
| Post-fix | `ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa` |
| Ancestry | Post-fix has pre-fix as its direct parent |
| Runtime | Node.js 22.23.2, npm 10.9.8 |
| Browser | Playwright 1.62.1, Chromium 151.0.7922.34 |

Both revision worktrees remained detached and clean. Both used the identical committed lockfile,
whose SHA-256 is `5bae88ae4fbc179f7eb6486b49dcaa4eb35a32abb134a6bc006cb7150689f955`.
The target declared no Node engine range. `npm ci` installed 900 packages at each revision and
reported the same 22 dependency audit findings; dependency remediation and security assessment were
outside this functional Spike.

## Blind protocol and frozen hypothesis

Only pre-fix source and runtime behavior were used to discover the storage fixture, UI locators,
reset, and outcome contract. Before a post-fix worktree was created or its source was read, the
candidate test and supporting hypothesis files were formatted, hashed, and independently rehashed.

- Frozen time: `2026-09-01T10:47:50.405Z`
- Standalone test SHA-256:
  `d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad`
- Frozen pre-fix signature: functional failure at `processing-cleared`, because
  `Analyzing locally...` remained visible.
- First post-fix execution: pass with the unchanged frozen bytes.
- The fix diff was inspected only after that first post-fix result.

The complete frozen file list and hashes are in `frozen-hypothesis.json`.

## Reproducer and independent outcome contract

Every attempt used a new browser context and this explicit reset:

1. verify `http://127.0.0.1:4173/upload` readiness;
2. create a fresh Chromium context and block non-loopback requests;
3. clear cookies;
4. open the script-free same-origin `/robots.txt` resource;
5. clear and verify localStorage, sessionStorage, IndexedDB, Cache Storage, and service workers;
6. seed only `unfollow-radar-store`, schema version 5, with synthetic
   `uploadStatus: "loading"` state;
7. navigate to `/upload`, wait for network idle, the upload heading, and two animation frames;
8. execute the ordered outcome checkpoints and close the context in `finally`.

Using `/robots.txt` for the reset avoids a proven race in which the already-running application
repopulates storage immediately after it is cleared. The state fixture is a controlled precondition;
storage rewriting is not an oracle.

The authoritative contract checks the rehydrated user interface:

1. `/upload` and its heading are observable;
2. `Analyzing locally...` is hidden;
3. the processing status announcement is absent;
4. the file input labelled `Upload Instagram data ZIP file` is enabled;
5. the idle upload prompt is visible.

The file input's enabled state is the strongest direct operability check. The other functional
checks are semantic corroboration of the same `isProcessing` branch, not four independent causal
proofs. No screenshot or model statement determines the verdict.

## Differential and repetition

| Test | Pre-fix | Post-fix | Retries | Model calls |
| --- | ---: | ---: | ---: | ---: |
| Frozen standalone test, first run | 1 expected functional failure | 1 pass | 0 | 0 |
| Frozen standalone test, gate | 20/20 expected functional failures | 20/20 passes | 0 | 0 |
| Recorder-style baseline, gate | 20/20 expected failures | 20/20 passes | 0 | 0 |

All 20 frozen pre-fix attempts failed first at `processing-cleared`; none failed during startup,
reset, browser execution, or observability. All 20 post-fix attempts passed every checkpoint. The
same spec hash, Chromium version, viewport, server command, reset, and outcome contract were used.

Raw Playwright reports remain in ignored local output because they contain local paths and stack
locations. `attempts.jsonl` retains the 40 normalized gate attempts without those private details.

## Minimization

The candidate began with two browser navigation actions:

1. navigate to a script-free same-origin resource for reset;
2. navigate to `/upload` after seeding the interrupted state.

The first is required by the explicit reset. Deleting the second was replayed with a fresh context
on both revisions: both remained on `/robots.txt`, the upload page was unobservable, and the outcome
was `inconclusive`. The action therefore remains required. Final action count: **2 of 2**.

## Recorder-style comparison

| Dimension | Frozen semantic test | Straightforward baseline |
| --- | --- | --- |
| Navigation action count | 2 | 2 |
| Precondition clarity | Explicit reset postcondition plus versioned fixture | Clears and seeds the same fixture, without an explicit reset assertion |
| Selectors | Accessible heading, label, status, and visible text | Tag/CSS ID plus text |
| Business-outcome clarity | External ordered contract with stable checkpoint IDs | Equivalent user-visible assertions, but only inline in the test |
| Unnecessary steps | Neither navigation is removable: one establishes verified reset and one opens the app | Same two necessary navigations; no artificial recorder noise |
| Failure-message quality | `functional-checkpoint:processing-cleared` identifies the first failed outcome | Generic locator assertion reports that the spinner remained visible |
| Differential | Pre 20/20 failure; post 20/20 pass | Pre 20/20 failure; post 20/20 pass |
| Maintenance assumptions | Storage key/schema version and English accessible UI remain stable | Same storage and English UI assumptions, plus DOM tags/ID remain stable |

No weak baseline was manufactured: it uses the same fixture, two actions, browser, viewport, reset
intent, and four user-facing results. ReproLock's advantage is evidence structure and diagnosis,
not a shorter or more stable workflow. That limited incremental advantage is a product risk.

## Explanatory root cause after the blind result

The pre-fix store persisted `uploadStatus: "loading"`, while the in-memory worker, file, promise,
and abort controller could not survive refresh. Rehydration marked the store hydrated but preserved
the impossible transient state, so no remaining control flow could return it to idle. The upload UI
therefore kept the spinner visible and file input disabled.

The post-fix commit normalizes only a rehydrated `loading` status to `idle`. It also adds a manual
cancel path, but the frozen test never uses that control; the successful result comes from the
rehydration behavior. The oracle was not reverse-designed from the fix.

## Commands and observed results

Substantive commands executed in this Spike included:

```text
git rev-parse --show-toplevel
git status --short --branch
git rev-parse HEAD
git worktree list --porcelain
git stash list
git switch -c spike/local-functional-regression
git clone --no-checkout https://github.com/ignromanov/safe-unfollow.git <target-control>
git worktree add --detach <pre-fix-worktree> 64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47
git worktree add --detach <post-fix-worktree> ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
pnpm exec tsc --project spikes/local-functional-regression/generated/tsconfig.json --noEmit
pnpm exec playwright test --config spikes/local-functional-regression/generated/playwright.config.ts
pnpm exec playwright test --config spikes/local-functional-regression/generated/playwright.config.ts --repeat-each=20 --reporter=json
pnpm exec playwright test --config spikes/local-functional-regression/baseline/playwright.config.ts --repeat-each=20 --reporter=json
node spikes/local-functional-regression/generated/replay-safe-unfollow-163.mjs --repeat 1
node spikes/local-functional-regression/tools/evidence-cli.ts materialize --bundle-root spikes/local-functional-regression <four-local-raw-reports>
node spikes/local-functional-regression/tools/evidence-cli.ts manifest --bundle-root spikes/local-functional-regression
node spikes/local-functional-regression/tools/evidence-cli.ts verify --bundle-root spikes/local-functional-regression
pnpm check
pnpm package:smoke
git diff --check
```

The target's 3000+ test suite was intentionally not run; the bounded browser differential did not
require it.

## Visible corrections during the Spike

- A PowerShell-unquoted `^{commit}` expression was parsed incorrectly; both objects were then
  revalidated using strictly quoted revisions.
- PowerShell's JSON converter rejected an empty lockfile property; lockfile version was read without
  changing the file.
- The first candidate run returned `reset-error` because the live upload app repopulated storage;
  reset moved to the script-free same-origin resource before the hypothesis was frozen.
- The first recorder-baseline run referenced a Node constant inside the browser execution context;
  the fixture was passed explicitly, then the baseline was rerun and typechecked.

No failed attempt was hidden or reclassified as success, and no automatic retry was introduced.

## Evidence verification

The four raw reports were accepted only after the evidence CLI bound them to the expected config,
spec filename, exact test title, one worker, repeat count 20, zero retries, and expected pre-fix
visible/hidden failure semantics. Materialization produced exactly 40 canonical attempts: 20
pre-fix `functional-failure` records at `processing-cleared` followed by 20 post-fix `pass`
records. Every record carries the frozen test hash and `modelCalls: 0`.

After all bundle files were finalized, the SHA-256 manifest was regenerated with 26 entries. The
final verifier returned exit 0 and
`{"command":"verify","issues":[],"ok":true,"schemaVersion":1}`. It independently checks required
files, exact manifest bytes, all frozen hashes, the 20 + 20 repetition gate, materialized summaries
against attempts/frozen metadata/source, canonical schema-versioned JSON, and absence of committed
machine-local paths. The raw reporter files remain ignored and are represented by their hashes and
portable run metadata.

`pnpm check` also returned exit 0: formatting, lint, strict root typecheck, all 23 unit tests, and
the 1/1 loopback browser test passed. Both standalone-test TypeScript projects typechecked; package
smoke passed at 86,371 bytes. The post-fix replay wrapper passed 1/1 after its loopback guard was
added, while `TARGET_BASE_URL=https://example.com` exited 1 before readiness access as required.

## Limitations and conditional exit

- The issue supplied the critical interrupted-state concept and suggested the likely `loading`
  field; exploration primarily verified exact key/schema and UI semantics.
- Storage seeding is deterministic but implementation-coupled. A UI-only way to interrupt the real
  parser would be less coupled but slower and more variable.
- The baseline matched the generated test's action count and stability, limiting proof of product
  differentiation.
- Evidence covers Windows, one Chromium build, one target, and one unusually detailed Issue.
- The newly created control clone used `--no-checkout`; its index reports default-branch deletions.
  The two tested revision worktrees are clean and authoritative, but the control clone itself must
  not be described as clean.
- The target dependency audit findings were recorded but not investigated because this was not a
  security task.

Owner for removing the conditional status: the next ReproLock external-validation phase. Acceptance
condition: a second user-supplied, less-structured functional case must require genuine outcome and
workflow discovery, retain a model-free stable differential, and show a clearer maintainability or
effort advantage over an honest manual baseline.

## Cleanup and scope preservation

- All target servers were stopped and port 4173 was released.
- Every browser context was closed; screenshots, videos, and traces were disabled.
- Pre-fix and post-fix detached worktrees are retained locally, clean, and unmodified for
  reproducibility; their `node_modules` remain ignored.
- No target branch was changed or pushed, and no PR or Issue was created.
- Legacy ReproLock worktrees, `integration/wave1`, and the backup stash were untouched.
- No provider, GitHub Action, Mutation, WebMCP, package release, website, or second target work was
  started.

Final verdict: **`SPIKE_CONDITIONAL`**. Product `GO`: **not obtained**.

## Recovery revalidation — 2026-09-04

The earlier sections describe the 2026-09-01 experiment and its checks at that time. On recovery,
format and four unit tests failed and the bundle verifier reported eight issues. Those historical
success statements were not used as current acceptance evidence.

The uncommitted run-envelope design sampled current source hashes while importing old reports;
it could not prove historical runtime provenance. It has been removed. The v1 summary contract,
all nine frozen hypothesis files, the original forty attempts, and original raw reports remain
unchanged. The old manifest is retained at `history/2026-09-01-manifest.json`; the root manifest
now covers the reviewed current bundle. Verification establishes integrity and internal
consistency, not authenticated execution history.

The repaired importer requires twenty unique test IDs, exactly one test/result per spec, explicit
zero retries, correct failure semantics, and no errors attached to a pass. It checks frozen/core
inputs before writing and refuses to replace different existing run evidence. Tests also reject
minimization corruption, empty execution branches, opaque errors, path leaks and redirects.

Fresh evidence at `revalidation/2026-09-04/` records both generated and manual baseline tests:
pre-fix 20/20 expected failures; post-fix 20/20 passes; no retries and no model calls. Target HEAD
and clean status were checked before/after each side. Source/config/lockfile/report hashes were
captured during this execution, not inserted into the old experiment. The unchanged standalone
spec SHA-256 remains `d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad`.

Cancellation and timeout were each exercised with a running Playwright/browser tree on Windows:
seven owned processes observed in each test, zero survivors. Normal post-fix wrapper replay passed
1/1. Both owned target process trees were stopped; the external revision worktrees remained clean.
These are local process-cleanup results, not a claim about every operating system.

`SPIKE_CONDITIONAL` and the manual-baseline value limitation remain unchanged. The next product
decision requires the owner to supply a less-structured case and admit its scope; no second case
or production implementation has started. Final engineering commands and remote delivery are
recorded in `harness/context/02-local-functional-regression-spike-a.md`.
