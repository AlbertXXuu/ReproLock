# Verifying a DrawDB browser history regression against frozen builds

2026-10-02 · ReproLock

[简体中文](verified-browser-regression.zh-CN.md) · [Website reading view](https://alvenx.com/notes/engineering/verified-browser-regression)

A standalone Playwright candidate distinguished DrawDB revisions before and after Issue 687's fix. ReproLock preserved the repeated differential, build identity, and cleanup evidence, while the ordinary Playwright control exposed the limits of the product value claim.

## A replay must distinguish a bug from a broken environment

DrawDB Issue 687 supplied a concrete browser history regression for local verification. The reviewed workflow starts from an empty diagram, creates and saves a table, and uses browser back navigation. Its outcome assertion expects pathname /; the pre fix revision remains at /editor.

A test failure alone would be ambiguous if startup, reset, readiness, or cleanup failed first. ReproLock therefore checks one standalone Playwright candidate against exact pre fix and post fix revisions and accepts only the specified business assertion as a functional failure. The candidate was agent authored after reading the official issue and PR hints, including a code excerpt. That provenance matters when assessing what the experiment measures.

[DrawDB official issue](https://github.com/drawdb-io/drawdb/issues/687) · [Official fix PR](https://github.com/drawdb-io/drawdb/pull/692) · [Recorded experiment and authoring provenance](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/REPORT.md)

## Freeze the candidate and the served application

The comparison uses da0f084d47cd5cb4992df6d3a23707543338e796 and its direct child 9df18ecc272caf5c2368fc305ae40788103fd0d0. The candidate and parameters were frozen before inspecting post fix source or the diff, but the prior official hints mean this is verification of a prepared candidate, not blind issue to test generation.

Git identity was insufficient because Vite preview serves ignored dist files. The experiment also froze sorted inventories of path, byte count, and SHA-256 for all 28 build files per revision. Clean Git state, full revisions, target fingerprints, and build inventories had to remain unchanged before and after both arms. This ties the result to the application actually served.

[Build inventories and execution gates](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/comparison.json)

## Keep the candidate readable and the outcome independent

The candidate imports ordinary Playwright and has no ReproLock runtime dependency. Reset, empty diagram, table creation, and save completion checks run before a native outcome assertion. The only accepted pre fix difference was at candidate.spec.ts line 54: expected /, received /editor. Missing readiness or navigation observations would make a result inconclusive.

The formal settings use Playwright 1.62.1, headless Chromium, a 1280 by 720 viewport, one worker, zero retries, 20 repetitions per revision, and a 20 second test timeout. Capture is off. ReproLock adds target and build verification, classification, bounded execution, process cleanup, and a portable export around that test.

[Standalone candidate](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/candidate.spec.ts) · [Portable verifier export](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json)

## Both arms reproduced the same differential

The accepted September 4 run recorded 20/20 functional failures before the fix and 20/20 passes after it. Ordinary Playwright achieved the same checkpoint differential with the same stability. Both arms verified process cleanup with zero survivors. The control shares the candidate and business settings; its coordinator boundary is not identical, including the ReproLock WebSocket restriction.

An earlier run also observed 20 failures and 20 passes, but its build inventory was frozen after execution began and post fix cleanup was unverified. It remains recorded as an excluded error. Preserving that failed gate prevents a later successful result from rewriting the experimental history.

| Accepted arm | Before the fix | After the fix | Cleanup |
| --- | --- | --- | --- |
| ReproLock local verifier | 20/20 functional failures | 20/20 passes | Verified with 0 survivors |
| Ordinary Playwright | 20/20 same checkpoint failures | 20/20 passes | Verified with 0 survivors |

[Accepted and excluded executions](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/comparison.json)

## Verification succeeded while product value remains open

The verifier arm took 169.454 seconds including startup, both suites, and cleanup. Ordinary Playwright arm totals were 71.107 seconds before the fix and 70.624 seconds after it. The control was equally stable and faster locally. These agent operated runtimes do not measure developer effort; setup, authoring, maintenance savings, and independent adoption remain unmeasured. The product decision stays SPIKE_CONDITIONAL.

The portable evidence can be checked without a model call; raw control reports remain local because they contain absolute paths, so CI checks the projection's internal consistency. SWT-Bench is relevant primary research on issue reproduction and generated tests as fix checks. This single browser case supports a verified differential and inspectable provenance, with broader compatibility and human value still open.

[Runtime measurements and remaining gates](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/REPORT.md) · [SWT-Bench primary paper](https://arxiv.org/abs/2406.12952v3)

## Original evidence

- [DrawDB experiment report](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/REPORT.md)
- [Frozen builds and comparison evidence](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/comparison.json)
- [Standalone Playwright candidate](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/candidate.spec.ts)
- [Portable ReproLock evidence](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json)
