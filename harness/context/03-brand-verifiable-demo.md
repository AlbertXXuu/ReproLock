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
- `pnpm package:smoke` on both runtimes: passed, 107 entries at the full matrix check;
  the final archive check passed with **108 entries / 361,348 bytes** after adding the recorded-run
  gate script. The private package
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

## Independent export acceptance

Exported source commit `ae7c9817b4119743086c33dee1aa12d2913a8961` with `git archive` into a
new directory outside the AlvenX workspace, without copying a working directory or dependencies.
`pnpm install --frozen-lockfile` installed the nine locked dependencies; `pnpm brand:verify`,
`pnpm demo:verify:recorded` and `pnpm test:browser` passed (4/4 browser tests). The command
`pnpm demo --config demo.local.json --port 4319` started the exported application at
`http://127.0.0.1:4319`. The local config points only at the same explicitly supplied target
worktrees. The archive and actual install/browser logs are in the audit directory above.

The recorded-run CI gate explicitly requires the three expected final statuses and a confirmed
differential only for the complete run. A valid cancelled/partial export cannot silently replace
the checked-in complete demonstration.

## Original delivery integration and limits

Original delivery completed in [PR #3](https://github.com/AlbertXXuu/ReproLock/pull/3), main
`a83195f22f01aedfd3595b1890a39c5d14dac66b`. [PR CI](https://github.com/AlbertXXuu/ReproLock/actions/runs/33884213031)
and [main CI](https://github.com/AlbertXXuu/ReproLock/actions/runs/33885702203) passed both Node jobs.
The local integration receipt records the actual GitHub rendering and clean D-main synchronization.
Historical experimental results have not been relabeled as current execution.
Product decision remains **SPIKE_CONDITIONAL**: one unusually detailed case, equivalent manual
baseline, no measured effort/maintenance advantage, no general issue-to-test flow, no public release.

## README signal alignment — 2026-09-04

The owner requested the same pure 320px AlvenX wordmark across project READMEs with a separate
small signal. ReproLock now places `<br>` and `<sub>FUNCTIONAL REGRESSION EVIDENCE</sub>` below
the existing SVG, before the unchanged H1 and body. The standalone brand assertion and active
brand instructions use this format. The historical registration patch remains unchanged; the
current AlvenX parent contract owns later shared changes.

Checks on this bounded update:

- `node scripts/verify-brand.mjs`: PASS, five controlled assets and one README.
- `node_modules/.bin/biome.cmd format scripts/verify-brand.mjs`: PASS, one file, no fixes.
- `node_modules/.bin/biome.cmd lint scripts/verify-brand.mjs`: PASS, one file, no fixes.
- `git diff --check`: PASS.
- Independent source comparison: exact requested header; README body unchanged from HEAD;
  SVG byte-identical to the canonical master, SHA-256
  `8ae10e02c27091e29e0191a7934506118f144aae11898b20222d7f9d587e2662`;
  no diff in `docs/brand-registration.patch`.

The coordinating task verifies the parent brand/workspace contract and shared README rendering.
This update does not rerun the real target or change Demo UI/logic, versions, frozen evidence,
dependencies or Git references. GitHub rendering is not revalidated by these local source checks.

## English interface alignment — 2026-09-04

The owner requested English throughout the Demo, consistent with the other AlvenX products.
The cross-project brand task explicitly transferred its six finished files and stopped writing
ReproLock; the preserved changes became `28c17d3`. Its subsequent owner-approved centered
wordmark became `273d75f`. The wordmark changes only its master translation; the shared header
geometry and product CSS remain unchanged.

Changed static copy, `lang="en"`, accessible labels, dynamic statuses/errors, matching setup
instructions and the current README screenshot. No language selector, new dependency or execution
logic was introduced. `Execution finished`, `Inconclusive` and `Unconfirmed` preserve the original
meaning; saved results explicitly say `Not re-executed`.

Actual baseline: `pnpm brand:verify` and `pnpm test:browser` passed (4/4). After translation:
`pnpm check` passed 80/80 unit/process tests and 4/4 browser tests, historical evidence and all three
recorded Demo checks. The first full check found two formatter wraps; the scoped formatter fixed
those, then the complete check passed. Both logs are retained. Shared `validate_brand.py` passed
22 resources / 5 unified README headers; `validate_workspace.py` passed five independent repos.

Manual browser inspection confirmed actual English content at 390/900/1440px, no Han characters
in the rendered owned UI, no horizontal overflow and the canonical header/font. Reopened actual
complete, cancelled (8/8), timed-out (3 starts / 2 completed) and startup-failed (0/0) records;
all are explicitly saved results. Partial states retain an unconfirmed differential. No new
20+20 experiment was needed because the runner and evidence sources are unchanged.

Current screenshots and observed checks: `output/playwright/english-demo-20260904/`.
`docs/demo-evidence/demo-1440.png` shows saved run `20260904T134401616Z-abed6b50` in the current
English UI. The earlier Chinese screenshot remains in Git history and its original local output.
Of 250 protected files, 247 are byte-identical; only the newly approved wordmark, its provenance
and this current screenshot changed. Frozen tests, raw reports, exports and runner code remain exact.

Independent read-only review found no remaining blocker. `pnpm package:smoke` passed with 108
entries / 369,157 bytes before this receipt update. A `git archive` of
`0e02daca5b4aab4c6a5b02e876aa10480f243849` was extracted into a new directory outside AlvenX;
`pnpm install --frozen-lockfile`, `pnpm brand:verify` and `pnpm test:browser` passed (4/4).
Ten current computed header properties match the preserved accepted Studio reference; canonical
CSS is unchanged. Exact PR/main integration receipts are retained in
`.workspace/audits/reprolock-english-demo-20260904/` in the parent AlvenX workspace and the PR,
so recording the final merge does not change the tested source tree.

## AlvenX header activation follow-up — 2026-09-04

English PR #4 merged as `5b16d22`; both its PR and main Node 22/24 CI jobs passed and the
fixed D checkout was clean before the owner added uniform logo activation through the brand
coordinating task. Branch `codex/alvenx-header-home` implements that scoped request with one writer.
Baseline `pnpm brand:verify` and `pnpm test:browser` passed (4/4) before editing.

The native `AlvenX — Back to top` button wraps the unchanged wordmark. Its click handler returns
immediately at scrollY zero, otherwise scrolls the current document to top zero while preserving
scrollX; reduced motion uses `instant`, otherwise `smooth`. No navigation or execution state is
changed. The exact approved canonical CSS now includes the button reset and visible focus rules;
its SHA-256 is `b4bc3051213c2d9a1a37af80233d0b4978941d73c5945f6a792b84271e1d5c0c`.
Provenance records independent home-navigation revision `2026-09-04.1`.

Actual `pnpm check` passed 80/80 unit/process and 4/4 browser tests. Existing browser coverage now
checks pointer, Enter and Space under normal and reduced motion, true document top, activation
at the top, and preservation of the selected saved result, export, expanded source, URL/hash,
history and document lifetime. The three widths retain the canonical geometry and 160px wordmark;
the button has visible keyboard focus. All historical and recorded evidence verifiers passed.
`pnpm package:smoke` passed (108 files / 370,413 bytes before this receipt update).
Shared brand validation passed 22 assets, five README headers and five header-navigation contracts;
workspace validation passed five independent repositories. Independent read-only review passed.

The independent source export and exact PR/main CI integration receipts are recorded after the
source commit in `.workspace/audits/reprolock-header-home-20260904/` in the parent workspace and
the PR. This follow-up preserves all raw experiments and screenshots and does not repeat or
reclassify the historical 20+20 experiment. Product stage remains `SPIKE_CONDITIONAL`.
