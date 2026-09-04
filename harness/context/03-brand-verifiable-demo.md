# Brand and Demo execution record

Baseline and authorized scope: `plans/03-brand-verifiable-demo.md`.

P2 prerequisite merged as `1c7163b281602d6c3456808225f824678d364364`:
[PR #2](https://github.com/AlbertXXuu/ReproLock/pull/2),
[PR CI](https://github.com/AlbertXXuu/ReproLock/actions/runs/33875895968),
[main CI](https://github.com/AlbertXXuu/ReproLock/actions/runs/33876168078), all passed.

## Implemented and reviewed

Brand registration is commit `0ed04d9`. Five canonical assets are controlled copies; standalone
`pnpm brand:verify` checks their hashes and the 320px README header. The shared validator now
checks the separate 330×100 ReproLock consumer and exact UI/font resources. Its generator consumer
list and release manifest are registered without rerendering any existing asset. The non-Git
AlvenX workspace changes are preserved as `docs/brand-registration.patch`.

The Demo uses Node HTTP/process/filesystem APIs and the existing Playwright dependency. One
synchronous startup reservation protects one run; target commands come from fixed case config.
The standalone test/config and historical bundle are unchanged. The new orchestrator owns both
target and browser trees; the existing replay wrapper remains available with its prior contract.
The reporter publishes observations atomically; the completed Playwright report is independently
validated and compared with the progress projection. Portable exports retain failure diagnostics,
exact identities, execution exits and cleanup; their verifier also rejects semantic contradictions
after a manifest refresh. The historical full-bundle verifier gains only an additive exported
generated-report validator, and its current manifest entry is refreshed.

Read-only independent review found and prompted fixes for startup concurrency, failed inventory
cleanup, queued process snapshots, strict cleanup field types, raw/projection bindings, final-write
rejections and stale retained-record UI handlers. The corrected true/false cleanup field, post-fix
exit and raw-binding mutations were independently reproduced against the actual export and rejected.

## Actual local executions — 2026-09-04 UTC

All three runs were started through the real local Demo browser UI. They used the existing supplied
target worktrees with exact clean pre/post revisions. Original reports/logs and atomic observations
remain in ignored output; `docs/demo-evidence` contains portable exports, not recreated reports.

| Run | Evidence path | Actual observations | Result |
| --- | --- | --- | --- |
| Complete | `output/demo/20260904T134401616Z-abed6b50` | pre 20/20 functional failures; post 20/20 passes | integrity, consistency, differential true |
| Cancelled | `output/demo/20260904T134928316Z-418b2afb` | 8 starts, 8 completed pre-fix observations | exit 130; differential false |
| Deadline | `output/demo/20260904T135154727Z-c1cc60b4` | 3 starts, 2 completed pre-fix observations | 15,000ms deadline, exit 124; differential false |

Complete execution: **13:44:01.617–13:46:23.619 UTC**, first failure
`pre-fix #1 / processing-cleared`; every pre-fix assertion retained the actual
“Analyzing locally...” expected-hidden/received-visible diagnostic. Raw reports:

- pre SHA-256 `971be2ed5e3ad03d4c40e7ff6b3cd5bf751c1f04a6aeaf8fce9a4dc4b7c0e57c`, exit 1;
- post SHA-256 `ad4cf1f426e6ebbe45564730d2d178bfb1701329d7f386708b839178b2fc7fc5`, exit 0.

Observed browser/target identities at cleanup: complete pre 90/3, complete post 77/4,
cancelled 41/5, deadline 17/4. Each cleanup independently reported zero survivors and verified true.
Counts are observed process identities over the run, not concurrent browser counts. Target Git
state stayed clean. Hashes of all four captured Demo source files match the actual source bytes.

## Actual checks

- `pnpm check`, Node **22.23.2**, ordinary terminal environment: passed; **80/80 unit/process
  tests**, **4/4 Chromium browser tests**. No model, external target or credential needed for CI.
- `pnpm check`, pinned Node **24.20.0**, `CI=true`: same complete pass. Both environments use
  pnpm **11.19.0**, `enableGlobalVirtualStore:false`, `verifyDepsBeforeRun:error`.
- `pnpm package:smoke` on both runtimes: passed, **107 archive entries**; the private package
  includes every standalone Demo UI/font/resource. No publication/installability claim is made.
- `pnpm evidence:verify`: complete historical bundle passed.
- `pnpm demo:verify:recorded`: complete/cancel/deadline exports all internally consistent;
  only the complete run has `differential:true`.
- `python foundation/brand/validate_brand.py`: passed, **19 resources, 2 masters, 3 older
  lockups plus the ReproLock subtitle-free consumer**.
- `python operations/tools/validate_workspace.py`: passed, five independent repositories.
- 70 pre-existing protected files compared to the pre-edit snapshot: **69 byte-identical**;
  the only change is the explicitly refreshed current Spike manifest, not historical evidence.
- Original three lint informational messages and the non-failing inherited color-env warning
  remain. Restricted sandbox CIM/taskkill was denied; its test tree was identified and cleaned,
  then both real process lifecycle tests passed with ordinary user process permissions.

Logs and original shared registration bytes are retained in the AlvenX audit directory
`.workspace/audits/reprolock-brand-demo-20260904/`.

## Browser and brand evidence

Chromium tests actually load the local font, SVG, CSS and license at **390/900/1440px**, confirm
160px wordmark, no horizontal overflow, visible keyboard focus, reduced-motion behavior, honest
startup failure with zero attempts, reopening completed records without reload and concurrent
control rejection. Manual Edge UI inspection also confirmed live execution, cancellation, deadline,
historical/current separation, code/download links and the real first failed checkpoint.

`docs/demo-evidence/header-comparison.json` records **12 identical computed header properties**
against the already running BrowserAgentRegression Studio at the same 1440px viewport. Actual
height is 74.4844px (70px is the minimum); width is 1281px with the 15px scrollbar, not an assumed
nominal width. Canonical top/padding/gap/radius/border/fill/shadow/blur all match.

Screenshots: `output/playwright/demo-acceptance/` contains `running-1440.png`,
`completed-1440.png`, `completed-900.png`, `completed-390.png`, `cancelled-900.png`,
`timeout-900.png`. The README includes the complete 1440px screenshot. Responsive captures were
checked against actual `innerWidth`, not merely the requested browser override.

## Remaining handoff gates and limits

Independent export/install, final PR CI and merge/main synchronization are pending the following
handoff step. Historical experimental results have not been relabeled as current execution.
Product decision remains **SPIKE_CONDITIONAL**: one unusually detailed case, equivalent manual
baseline, no measured effort/maintenance advantage, no general issue-to-test flow, no public release.
