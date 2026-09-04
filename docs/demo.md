# Run the verifiable local Demo

This is the owner-authorized **single Safe Unfollow #163 case**. It does not accept arbitrary issue
text, generate tests, call a model, publish a site, or establish product value. `SPIKE_CONDITIONAL`
remains the product decision. Historical experiments and each new run have distinct dates/sources.

## Setup and start

Use Node 24.20.0 (minimum 22.23.2), pnpm 11.19.0, Git and Chromium:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Copy `demo.example.json` to ignored `demo.local.json` and set both paths to the **supplied local**
Safe Unfollow worktrees. Paths resolve relative to the shell's working directory. The required
origin is `https://github.com/ignromanov/safe-unfollow.git`; exact clean revisions are:

| Side | Revision |
| --- | --- |
| pre-fix | `64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47` |
| post-fix | `ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa` |

Run `npm ci` in each supplied target before starting. The Demo checks the committed lockfile,
clean Git state, Vite installation and frozen test/config hashes. It starts the target's existing
`vite` development script through its installed Node entry point with the fixed arguments
`--host 127.0.0.1 --port 4173 --strictPort`. Keep 4173 free; it never kills another port owner.
The unchanged test independently resets and verifies origin storage before every repetition.

```sh
pnpm demo --config demo.local.json
```

Open **http://127.0.0.1:4317**. `--port 4318` changes only the Demo's UI port; target execution stays
on 4173. Click **检查运行条件**, then **运行 20 + 20 次验证**. The same frozen test executes sequentially
on both revisions, with one worker, zero retries and no model calls. Expected pre-fix failure is
`processing-cleared`: “Analyzing locally...” stays visible. Post-fix must pass every outcome check.

The default complete-run deadline is 1,200,000ms (20 minutes). `timeoutMs` in the local config may
be set to 1..1,500,000ms; short deadlines are useful to exercise timeout handling. Readiness is
bounded to 30 seconds per side. Cancel stops the owned Playwright/browser and target trees.
On Windows, run in an ordinary user terminal with permission to inspect and terminate its own
processes. Restricted sandboxes can deny CIM/taskkill; cleanup then remains explicitly unverified.
Ctrl+C shuts down the HTTP server after cancelling an active run.

## Inspect and export

Each run creates a fresh `output/demo/<timestamp-id>/`, including startup failures and cancellation:

- `started.json`: start metadata, preserved before prerequisite checks.
- `observations/<side>/`: atomic started/completed/end reporter records; unfinished repetitions
  are not synthesized. The progress display is provisional until all final checks complete.
- `raw/`: actual Playwright JSON and local diagnostic artifacts; these may contain target paths,
  stay ignored, and are excluded from the portable export.
- `export.json`: frozen standalone test/config, minimized reports, attempts, execution/cleanup
  records and a canonical SHA-256 manifest. No target paths or raw page text are exported.
- `verification.json`, `final.json`: independent current-run verification and observed final state.

The UI exposes each attempt's classification/checkpoint and a download of `export.json`.
It distinguishes integrity, record consistency and the full 20+20 differential:

```sh
pnpm demo:verify output/demo/<timestamp-id>/export.json
```

Exit 0 means an intact internally consistent export. Inspect `differential`: cancelled, timed-out,
startup/error and partial runs cannot grant that gate, even when their retained evidence is intact.
The verifier checks execution exit codes, exact revisions/source, report bindings and independently
derived attempts, repetition identities, assertion diagnostics, and verified cleanup. The runner
cross-checks streaming observations against the actual Playwright report before completion.
Hashes establish integrity and internal consistency, not authenticated proof of who ran the test.

Download **测试** and **配置** to a separate directory to replay without ReproLock. Install only
`@playwright/test@1.62.1` and its Chromium, start the chosen supplied target as above, then run:

```sh
npx playwright test --config playwright.config.ts --repeat-each=20 --output=./artifacts
```

The `--output` override keeps artifacts in the independent directory while preserving the frozen
config's bytes. No ReproLock import or model credential is needed. A new Demo run checks only this
generated differential; `pnpm evidence:verify` separately verifies the complete historical Spike,
including its dated revalidation and manual baseline. Do not copy historical successes into a new run.

## Acceptance and limits

`pnpm check` includes brand resources/README, strict TypeScript, evidence mutation tests, owned
process lifecycle tests, and real Chromium UI tests at 390/900/1440px. CI uses a missing disposable
target to test honest startup failure and concurrent-control rejection; it does not claim to rerun
the supplied external target. Exact local 20+20/lifecycle results, screenshots, same-viewport header
comparison and independent-export checks are recorded in `harness/context/03-brand-verifiable-demo.md`.

Only the newest 30 run directories are listed in the UI; older files remain preserved on disk.
There is no automatic retention deletion, recovery of a process killed outside the controlled
shutdown path, general generator, second case or public deployment. Abrupt host/process failure can
leave only `started.json` and atomic observations; such a run has no verified success/export.
