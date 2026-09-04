# Phase context — DrawDB #687 value validation

## Scope and source

- Repository: official `https://github.com/drawdb-io/drawdb.git`, AGPL-3.0.
- Issue: `https://github.com/drawdb-io/drawdb/issues/687`.
- Fix PR: `https://github.com/drawdb-io/drawdb/pull/692`.
- Pre: `da0f084d47cd5cb4992df6d3a23707543338e796`.
- Post: `9df18ecc272caf5c2368fc305ae40788103fd0d0`, direct child.
- Candidate SHA-256: `2d7fbfcf5701625050aec23491e3beb8746641c27bcd6326446cea73871aa9f2`.
- Known limitation: official issue/PR prose and a code excerpt were read before freeze. The candidate
  is not strict blind-discovery or independent-human evidence.

The local target worktrees are retained at
`D:/.Development/AlvenX/.workspace/experiments/reprolock-drawdb-687-20260905/pre-target`
and `post-target`. The experiment used only loopback and synthetic browser-local diagram data.

## Preparation evidence

Both targets used the same committed package lock and these trusted repository commands:

```powershell
npm ci --ignore-scripts
npm run build
```

Pre install/build: 575 packages in 42 seconds; 4,117 modules built in 62 seconds. Post: 575 packages
in 23.622 seconds; 4,117 modules built in 49.23 seconds. Existing npm audit findings and Vite's large
chunk warning were not modified or represented as ReproLock findings.

The format-only final candidate passed strict TypeScript and a one-run pre qualification. That run
verified empty diagram, `No changes`, table count one, `Last saved`, observed popstate, then received
`/editor` against expected `/`. Freeze time was `2026-09-04T18:00:55.801Z`; the formal 1280×720,
20-repeat contract was recorded before post checkout.

## Preserved failed run

Command:

```powershell
node src/verify/cli.ts run output/drawdb-687.local.json
```

Local run `output/verify/run-ZjP70x`, 151,328 ms: pre 20/20 functional failures and post 20/20
passes, but post cleanup was not verified. Its bundle status is `error`, differential is false and
exit is 2. It is also excluded because the complete served build inventory was frozen after this
run began. The raw bundle, reports, process logs and timing remain under ignored `output/`.

## Formal execution

Before either formal arm, a sorted relative path, byte count and SHA-256 inventory was frozen for
all 28 `dist` files per target. Pre inventory digest:
`6327efc440843405549092674efd32c53247fcbb05fc2a4fa507463adf7d47d0`; post:
`ec5f3dba954a710a4b6df275e65a2496dc4fd8470342f9ea705f72b41091ad68`.
Every formal stage checked revision, clean state, target fingerprint, candidate and both inventories
before and after execution.

The local bounded harness ran the documented verifier command, followed by ordinary Playwright on
each revision with the same frozen candidate and business settings. It used Chromium headless,
1280×720, one worker, zero retries, 20 repeats, 20-second test timeout, service workers blocked and
capture off. The verifier adds a same-origin WebSocket guard; the ordinary arm therefore has the
same candidate/settings but not an identical coordinator boundary.

- Verifier `output/verify/run-0p4nWw`: completed/differential true; pre 20/20 functional failures,
  post 20/20 passes; inner and outer cleanup verified, zero survivors; 169,454 ms.
- Ordinary Playwright pre: exit 1; 20/20 failed only at `candidate.spec.ts:54:75`, expected `/`,
  received `/editor`; runner 66,570 ms; arm 71,107 ms; cleanup verified.
- Ordinary Playwright post: exit 0; 20/20 passed; runner 66,298 ms; arm 70,624 ms; cleanup verified.
- Formal window: `2026-09-04T18:10:29.093Z` through `18:15:41.883Z`.

Local raw directory: `output/drawdb-bound-comparison/`. Raw Playwright reports and logs remain local
because they contain absolute paths. Their registered hashes bind the path-free projection but are
not independently rechecked by CI. Portable files:

- `spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json`
- `spikes/local-candidate-verification/drawdb-687/evidence/comparison.json`
- `spikes/local-candidate-verification/drawdb-687/REPORT.md`

Independent read-only reviews confirmed the oracle, report projection, exact build binding, all
40+40 observations and zero-survivor cleanup. `pnpm drawdb:verify:recorded` recomputes the ReproLock
gate and checks the portable candidate, revisions, inventories, paired ordinary observations,
configuration, outcomes and failure preservation.

## Product decision

Remain `SPIKE_CONDITIONAL`. This is the second stable case, but ordinary Playwright matched the
functional result and was faster in this run. Runtime is not developer effort. Human authoring and
maintenance benefit, general issue-to-test generation and external adoption remain unmeasured.
