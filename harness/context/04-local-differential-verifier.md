# Local candidate differential verification

## Scope and baseline

Owner-approved follow-up to the 2026-09-05 public-readiness review. Base main:
`5b13e23bfda5ffc954c77c9bfbe7a4f35f7d75e2`, initially clean. Sole source writer on
`codex/local-differential-verifier`; independent reviewers read source and evidence. The active
AlvenX website task owns another project. Historical Spike files and recorded Demo exports remain
untouched. Product status remains `SPIKE_CONDITIONAL`.

## Actual commands so far

| Command | Observed result |
| --- | --- |
| Preserved early-cancel reproducer on the audited base | Direct cancellation lost; first HTTP trial returned 202 with no abort controller |
| `node --test tests/demo/run.test.ts`, before patch | Failed: actual `startup-error`, expected `cancelled` |
| Same test after patch | Passed; immediate/repeated cancel and shutdown preserve zero-attempt cancellation |
| `node --test tests/verify/cli.test.ts`, first implementation | Passed, real local Git/Chromium differential and operational negative controls, approximately 61 seconds |
| Same integration test after evidence tightening | Passed, approximately 56 seconds |
| `node node_modules/typescript/bin/tsc --project tsconfig.base.json --noEmit` | Passed after replacing unavailable TypeScript compiler API with Node's parse-only module API |

Additional actual checks:

- Ordinary-user PATH `pnpm --version`: 11.19.0. `pnpm check`: **82/82 unit/process and 4/4 browser
  tests passed**, with formatter, lint, brand, types, historical evidence and recorded exports
  passing. Local log: ignored `output/verify-check-20260905.log`.
- Expanded `node --test tests/verify/cli.test.ts`: passed in approximately 65 seconds, including
  cancellation after a real completed attempt, retained partial observations, verified cleanup
  and dirty-target rejection.
- Parent `python foundation/brand/validate_brand.py` and
  `python operations/tools/validate_workspace.py`: passed.
- `pnpm package:smoke`: passed, 116 files / 391,169 bytes at that snapshot; final archive contents
  additionally require the new verifier modules and usage document.
- Independent final source reviewer found no remaining submission-blocking issue. Documentation
  reviewer verified ordinary-user `corepack pnpm --version` = 11.19.0 and corrected copy/setup order.

Independent-export installation, second-case observations and GitHub delivery are pending.
None of these engineering checks is a product GO or an assertion of human time saved.

## Stable current contract

`pnpm regression check <config>` validates explicitly supplied local worktrees and a reviewed
self-contained Playwright candidate. `run` executes it unchanged on both clean expected commits.
`verify <export>` recomputes the new export's gate independently from any stored success flag.

V1 supports a trusted Node start entry, loopback readiness, 1–20 repetitions, one test/worker,
zero retries, verified reset and one native scalar `toBe` outcome assertion at the same callsite.
No model is called. Original candidate, startup/reset configuration and oracle are reviewed inputs.
Outcome meaning cannot be established from labels or trivial assertions alone.

Evidence uses a new schema independent of historical Spike/demo formats. Reporter observations
record bounded native step structure, callsites and hashed comparison/error data. Configuration,
runtime source and target fingerprints are bound to executions; completed attempts are retained
on interruption. Local diagnostic files are distinct from the portable candidate/observations.
Hashes establish consistency, not authenticated execution or an untrusted-code sandbox.

## Value protocol

Use an owner-selected second case with less structure than Safe Unfollow. Record provenance and
prior knowledge, establish reset/oracle on pre only, freeze candidate/config before post, and
retain every failed or inconclusive attempt. Compare an ordinary Playwright workflow with the
verifier using the same business coverage. Separate setup, authoring, corrections, review and
execution; report agent-operation measurements as such. Human time saved, independent usability,
maintainer retention and later maintenance require actual participants and remain unmeasured until
observed. Do not turn successful fixture or second-case execution into those missing claims.
