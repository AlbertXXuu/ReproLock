<p align="center">
  <img src="docs/assets/alvenx-wordmark.svg" width="320" alt="AlvenX">
</p>

# ReproLock

ReproLock investigates turning a user-supplied functional bug description or recorded browser
workflow into an independently checked, maintainable, standalone Playwright regression test.

## Status — 2026-09-04

The current implementation is one private TypeScript root application with deterministic evidence
utilities, a loopback fixture, one case-specific local functional-regression Spike, and an
owner-authorized local Demo for that supplied case.

Safe Unfollow #163 has an unchanged standalone test with **20/20 expected pre-fix failures and
20/20 post-fix passes**. The honest manual/recorder baseline achieves the same differential and
two navigation actions. The 2026-09-01 blind experiment is preserved; a separate 2026-09-04 run
revalidated both tests, with zero retries and no model calls. See the
[Spike report](spikes/local-functional-regression/SPIKE_REPORT.md) and
[dated execution evidence](spikes/local-functional-regression/revalidation/2026-09-04/execution.json).

The decision remains **SPIKE_CONDITIONAL**. Evidence structure and checkpoint diagnosis are useful,
but this unusually detailed case has not demonstrated enough incremental effort or maintenance
value to authorize production implementation. Source hosting and passing CI do not grant product GO.
There is no published package, general explorer/compiler, or released GitHub Action.
The recovered source and current engineering checks are available in
[private PR #1](https://github.com/AlbertXXuu/ReproLock/pull/1).

## Verifiable local Demo

Install the dependencies below, then copy `demo.example.json` to `demo.local.json` and point it at
the two supplied Safe Unfollow worktrees. Run `npm ci` in each target; see the
[exact revisions and setup](docs/demo.md).

```bash
pnpm demo --config demo.local.json
```

Open **http://127.0.0.1:4317**. Inspect the frozen source and historical evidence, check prerequisites,
then run the same test **20 times before and 20 times after** the fix. The UI shows actual progress,
first failed checkpoint, cancellation/deadline status and independent current-run verification.
Each run preserves its own evidence under `output/demo/`; failed attempts remain inspectable.
Download the ordinary Playwright test/config and portable evidence, then check an export with
`pnpm demo:verify output/demo/<run-id>/export.json`.

This demonstrates one supplied case. It does not establish incremental value over the manual
baseline or implement a general “issue → test” flow. See the [brand contract](docs/brand.md) and
[actual acceptance record](harness/context/03-brand-verifiable-demo.md).

![A real 20+20 local differential, with independent verification](docs/demo-evidence/demo-1440.png)

## Development

Use the saved D-drive ReproLock project as the fixed entry point. Work sequentially on a task
branch in that checkout, then return it to the verified `main` after an authorized merge.
Add a worktree only for a concrete parallel need. See the
[ownership and cleanup policy](docs/foundation/branch-and-worktree-policy.md).

Node.js 24.20.0 is the pinned primary runtime; 22.23.2 is the minimum. pnpm is pinned to 11.19.0.
The workspace fixes `enableGlobalVirtualStore: false` for both CI and ordinary terminals.
`verifyDepsBeforeRun: error` reports dependency drift before a script runs, without automatically
replacing `node_modules`. Run the explicit frozen install below when dependencies need updating;
no machine-specific store path or per-session environment override is required.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm package:smoke
```

`pnpm check` runs format, lint, brand/README validation, root and both standalone typechecks,
unit/process tests, Chromium fixture and Demo browser tests, and verification of the checked-in
Spike bundle. CI repeats those checks on
Node 22.23.2 and 24.20.0. The package smoke inspects archive paths, content and private metadata;
it does not claim an installable published product. No target checkout or model credential is
required for these engineering checks.

## Replay and evidence

The [frozen spec](spikes/local-functional-regression/generated/safe-unfollow-163.spec.ts) imports
only `@playwright/test`. Follow its [prerequisites](spikes/local-functional-regression/generated/safe-unfollow-163.meta.json)
to start the supplied local target on `127.0.0.1:4173`, then run:

```bash
node spikes/local-functional-regression/generated/replay-safe-unfollow-163.mjs --repeat 1
pnpm evidence:verify
```

The wrapper rejects readiness redirects, bounds execution, and terminates its owned Playwright
process tree on cancellation/deadline. The separately started target server remains the caller's
responsibility. Windows process cleanup was exercised with the real target; other platforms need
their own process-tree evidence beyond the CI fixture tests.

The verifier checks canonical bytes, hashes, frozen inputs, attempts, outcome/minimization
contracts and summary consistency. It requires all five registered 2026-09-04 revalidation files
and applies the same attempt/summary gates there, including execution identity, exit codes,
revision/report/source bindings, timing and cleanup consistency. The current case-specific verifier
checks the complete registered Spike bundle; materializing an isolated run alone does not satisfy
that full-bundle gate. A manifest is an integrity check, not an authenticated proof
of which source ran. The uncommitted run-envelope proposal was removed because computing current
hashes when importing a historical report cannot establish past execution provenance. Historical
v1 summaries and attempts remain byte-identical. Raw reports stay in ignored local output; their
hashes and normalized results are portable. Materialization refuses to replace a differing run:
use a new evidence root for each new experiment.

Captured tool hashes are checked against their independently inspected historical source commit
`bfc2d521631b1bb69a0bf83a1a512a213cf97211`; the four spec/config hashes also match current bundle bytes.
Updating the verifier does not rewrite historical execution records. These checks establish
internal consistency, and do not authenticate who executed the experiment.

## Repository map

- `src/domain/` and `src/evidence/`: terminal contracts, canonical JSON and atomic evidence writing.
- `src/demo/`: the bounded local Safe Unfollow Demo, runner, reporter and current-run verifier.
- `fixtures/loopback/` and `tests/`: executable foundation and bounded Spike regression checks.
- `spikes/local-functional-regression/`: frozen standalone output, case-specific evidence tools,
  historical records and separate dated revalidation.
- `reference/` and `docs/`: architecture baseline, accepted ADR and sequential ownership policy.
- `plans/` and `harness/context/`: exact commands, decisions, verification and remaining gates.
- `packages/` and `examples/`: admission notes; logical boundaries do not require empty modules.

See [PROJECT_CHARTER.md](PROJECT_CHARTER.md) and the
[architecture baseline](reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md) for independent oracles,
explicit reset, no-model replay, inconclusive handling, data minimization and release gates.
Historical Wave 1 branches and stash objects remain preserved and are not current predecessor evidence.

## Next gate

The owner has separately authorized the branded local single-case Demo. Removing the conditional status
requires a user-supplied, less-structured local functional case and an explicit scope/value decision.
That case must retain a model-free stable differential and show measurable effort or maintenance
benefit over an honest manual baseline. No second target, provider credentials, production packages,
public release or website work is admitted by this Demo task.
