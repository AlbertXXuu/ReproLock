# Verify a local candidate test

This experimental CLI runs one reviewed Playwright test unchanged against two exact clean local
Git worktrees, then checks whether the observed business assertion fails before the fix and passes
after it. It uses the pinned Node and Playwright installation from ReproLock. Start with the
[installation instructions](../README.md#development).

## Prepare the inputs

Use a repository supplied or selected by its maintainer. Create disposable pre-fix and post-fix
worktrees from the same Git repository, install their locked dependencies, and inspect the existing
start command. V1 supports an explicit Node entry point inside each target, including an installed
Vite entry point. The application must serve only the configured loopback address. The coordinator
checks clean full revisions, tracked package/lock files and unchanged start-entry fingerprints.

Review one self-contained TypeScript test importing only `@playwright/test`. Use the standard
`page`/`context` fixtures. The test must contain:

- One top-level `test.step('reset', ...)`, including assertions of the actual initial state. A fresh
  browser context alone does not reset server-side data; configure your disposable application and
  explicitly assert its reset postcondition.
- One later top-level `test.step('outcome', ...)` with a single direct `expect(actual).toBe(expected)`
  comparison of an observed scalar. Read the actual UI state before comparing it. Use the same
  assertion callsite on both versions. An example is `expect(await page.title()).toBe('Editor')`.

Actions and readiness waits belong between reset and outcome. Assertions should reflect the
maintainer's intended behavior. ReproLock checks execution evidence; human review establishes that
the reset and oracle mean what the issue requires. An assertion such as `expect(true).toBe(true)`
does not independently verify application state.

Use one test with zero retries. Expected failures, skips, extra tests, incomplete steps, locator/API
errors, unknown matcher diagnostics and unobserved outcomes cannot confirm a differential. Native
value comparison diagnostics are parsed conservatively; V1 recognizes `toBe` scalar differences.
The test remains an ordinary Playwright file when used without ReproLock.

## Configuration

Save the following as `output/my-case.local.json`, replacing the paths and full revisions with
your supplied local inputs. Paths resolve relative to this configuration file:

```json
{
  "schemaVersion": 1,
  "candidate": "../my-case.spec.ts",
  "targets": [
    { "path": "../../app-pre", "revision": "FULL_PRE_FIX_40_CHARACTER_SHA" },
    { "path": "../../app-post", "revision": "FULL_POST_FIX_40_CHARACTER_SHA" }
  ],
  "start": {
    "nodeScript": "node_modules/vite/bin/vite.js",
    "args": ["--host", "127.0.0.1", "--port", "4173", "--strictPort"]
  },
  "origin": "http://127.0.0.1:4173",
  "readyPath": "/",
  "resetDescription": "Describe the actual reset and the UI postcondition checked by the test",
  "repetitions": 3,
  "timeoutMs": 180000,
  "testTimeoutMs": 15000
}
```

The array order is pre-fix, then post-fix. Repetitions are 1–20; the total execution deadline is
at most 25 minutes, with a maximum 60-second test timeout. The supported start entry uses Node,
an argument array and no shell. Configure the same entry point and arguments for both versions.

```sh
pnpm regression check output/my-case.local.json
pnpm regression run output/my-case.local.json
pnpm regression verify output/verify/run-REPLACE_WITH_PRINTED_ID/export.json
```

`check` reads inputs and tests port availability without starting the application. `run` prints
the actual run directory, terminal status, per-attempt classifications and `differential`.
Exit 0 means the requested differential was confirmed; 2 means it was not confirmed, 124 is a
deadline and 130 is cancellation. `verify` independently recomputes the gate and exits 2 for a
partial, contradictory or non-differential bundle. Three repetitions do not satisfy the historical
Spike's separate 20+20 gate or establish broad reliability.

Ctrl+C cancels the current run and stops its owned processes. It never kills an unrelated process
by port. Unknown cleanup prevents confirmation. On Windows this requires permission to inspect
and terminate your own processes; a restricted execution sandbox may leave cleanup unverified.

## Evidence and trust

Each `run` invocation creates a new `output/verify/run-*` directory. Frozen candidate and guard sources,
effective Playwright configuration, source/target fingerprints, partial observations and final
reports remain separate from historical Spike records. Completed attempts are atomically saved
as they occur, so interruption does not turn missing attempts into successes.

The portable `export.json` contains the candidate, declared revisions, settings hashes, runtime
source hashes, target fingerprints and minimized observations. It includes native step categories,
assertion callsites, order and parent links, error digests and hashed expected/received scalar
representations. It omits error messages, screenshots, page bodies and target directory names.
Inspect the candidate itself before sharing; it is source code provided by the caller. The
`local-*` files and application logs stay local and can contain paths or application output.

The verifier recomputes hashes, classifications, repetition identity and the pre/post gate from
the pinned reporter's observations. These records establish internal consistency, not authenticated
proof of who executed the test. The reporter and candidate are trusted executable code. The browser
guard restricts the standard fixtures to the configured origin and the runner passes a small OS
environment allowlist; this is a local execution boundary, not an untrusted-code sandbox. Custom
browser launches, hidden model/network calls and dynamic loading are outside the reviewed contract.

## Value experiment

The engineering fixture verifies the CLI contract. A second real case should measure end-to-end
setup, authoring, review, corrections, execution and later maintenance against an equally strong
manual baseline. Agent elapsed time is recorded as agent operation time; it is not a measurement
of saved developer hours. External adoption and human effort benefit remain separate product gates.
