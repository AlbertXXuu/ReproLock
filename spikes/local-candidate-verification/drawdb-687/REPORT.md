# DrawDB #687 candidate-verification experiment

## Result

The frozen standalone Playwright test distinguishes exact DrawDB revisions for Issue #687:

| Arm | Pre-fix `da0f084` | Post-fix `9df18ec` | Process cleanup |
| --- | --- | --- | --- |
| ReproLock local verifier | 20/20 functional failures | 20/20 passes | verified, 0 survivors |
| Ordinary Playwright control | 20/20 failed at the same checkpoint | 20/20 passed | verified, 0 survivors |

The only accepted pre-fix difference was the native outcome assertion at
`candidate.spec.ts:54:75`: expected pathname `/`, received `/editor`. Reset, empty-diagram, table
creation and save-completion checks all completed first. Missing popstate, readiness or UI checks
would be inconclusive rather than a functional failure.

The result confirms this verifier can execute a second local real-repository case and retain a
reviewable differential. It does not show an effort advantage over ordinary Playwright, which
achieved the same result. The product therefore remains **SPIKE_CONDITIONAL**.

## Source and freeze

- Upstream: <https://github.com/drawdb-io/drawdb>, AGPL-3.0.
- Issue: <https://github.com/drawdb-io/drawdb/issues/687>.
- Fix: <https://github.com/drawdb-io/drawdb/pull/692>.
- Pre-fix: `da0f084d47cd5cb4992df6d3a23707543338e796`.
- Post-fix: `9df18ecc272caf5c2368fc305ae40788103fd0d0`, the direct child.
- Frozen candidate SHA-256: `2d7fbfcf5701625050aec23491e3beb8746641c27bcd6326446cea73871aa9f2`.
- Formal settings: Playwright 1.62.1, Chromium headless, 1280×720, one worker, zero retries,
  20 repeats per revision, 20-second test timeout, captures off.

The official issue and PR prose, including a code excerpt, were read before candidate freeze. This
is a reused, agent-authored candidate and not a blind discovery or independent-human authoring
experiment. No post-fix source or diff was inspected before the candidate and comparison parameters
were frozen.

Both revisions were installed from the same lock with `npm ci --ignore-scripts`, then built using
the repository's `npm run build`. Because `vite preview` serves ignored `dist` files, the experiment
froze a sorted path, byte-count and SHA-256 inventory of all 28 files per revision. Those inventories,
target fingerprints, clean status and revisions were unchanged before and after both arms.

## Actual execution

The formal ReproLock arm ran from `2026-09-04T18:10:29Z` to `18:13:18Z`: 169,454 ms including
application startup, two 20-run suites and outer verified cleanup. The ordinary Playwright runners
took 66,570 ms pre-fix and 66,298 ms post-fix; their arm totals including startup and cleanup were
71,107 ms and 70,624 ms. These are agent-operated local runtimes, not saved developer time.

An earlier 151,328 ms verifier run also observed 20/20 + 20/20, but is excluded: its build inventory
was frozen after execution began and post-fix cleanup was not verified. Its failed gate, hashes and
reason remain in `comparison.json` rather than being replaced by the later success.

`evidence/reprolock.json` is the portable verifier export. `evidence/comparison.json` contains the
full build inventories and a path-free projection of the ordinary Playwright reports. The raw
control reports and process logs remain local because they contain absolute paths; their SHA-256
values are registered, but CI can check only the portable projection's internal consistency.

## Reproduce locally

Create clean worktrees of the official DrawDB repository at the two exact revisions. In each, run:

```powershell
npm ci --ignore-scripts
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort
```

With one target running on loopback, this test remains ordinary Playwright and has no ReproLock
runtime import:

```powershell
corepack pnpm exec playwright test --config spikes/local-candidate-verification/drawdb-687/playwright.config.ts
```

For the verified pre/post workflow, create a local JSON configuration as documented in
[local verification](../../../docs/local-verification.md), point it at the two worktrees, and run:

```powershell
corepack pnpm regression check output/drawdb-687.local.json
corepack pnpm regression run output/drawdb-687.local.json
corepack pnpm regression verify output/verify/<printed-run-id>/export.json
corepack pnpm drawdb:verify:recorded
```

The two target worktrees stay outside this repository and are retained for reproduction. They use
only synthetic browser-local data and loopback serving; no account or external application is used.

## Remaining product gates

- No independent maintainer has authored, adopted or kept this generated test.
- Human setup, authoring and maintenance savings were not measured.
- The ordinary Playwright control was equally stable and faster in this local run.
- The general issue or workflow to generated-test path is still not implemented.
- Two cases cannot establish broad project compatibility or reliability.
