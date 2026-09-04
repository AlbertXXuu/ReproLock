# Brand and verifiable local Demo

## Goal and authorization

Deliver a branded, runnable Safe Unfollow #163 Demo whose current result comes from actual
20+20 frozen Playwright executions and independent evidence verification. The owner's
2026-09-04 appended prompt explicitly admits this single-case UI. The general product remains
`SPIKE_CONDITIONAL`; a second case, general generator, deployment and public release are excluded.

## Scope and inputs

One writer in the saved D-drive checkout, branch `codex/brand-verifiable-demo`. Changes may touch
ReproLock and the corresponding AlvenX `foundation/brand` consumer registration and validation.
Keep all frozen Spike inputs, dated evidence, recovery backups, target sources, other products
and website assets unchanged. The parent workspace is not a Git repository; preserve its exact
registration diff as a reviewable companion artifact in this repository.

Use the already supplied Safe Unfollow pre/post worktrees and exact revisions from the frozen
metadata. Start only the configured local Vite application at `127.0.0.1:4173`; the test's verified
origin reset remains unchanged. No command comes from issue text or browser input.

## Baseline

- P2 source `ac93c9e4f75a27937f1856893792559ba9c5dc76`, PR #2 merged as
  `1c7163b281602d6c3456808225f824678d364364`; exact-head CI 33875895968 and main CI
  33876168078 passed both Node 22.23.2 and 24.20.0.
- `git status --short --branch`: clean `main...origin/main` before this branch.
- P2 full checks: 55 unit assertions/subtests, 1 browser test, package smoke and evidence passed.
- `python foundation/brand/validate_brand.py`: passed, 14 assets / 2 masters / 3 lockups.
- `python operations/tools/validate_workspace.py`: passed, 5 independent repositories.
- Read all six required AlvenX source documents and compared the three existing README headers
  and Studio implementations. Brand 2026-08-24.1, interface 2026-08-25.2.

## Milestones

1. Preserve baseline hashes and shared registration originals. Copy approved assets unchanged,
   register consumers, add standalone README/asset checks, document durable brand requirements.
   Verify parent brand/workspace and project checks before the bounded brand commit.
2. Implement one local HTTP Demo and case-specific execution/report verification, reusing frozen
   output, attempt parsing and atomic persistence. No new runtime dependency. Each run has a
   fresh bounded output root; retain cancelled and failed observations. Stop only owned processes.
3. Test tampered current evidence, accurate interrupted/startup failure states, real 20+20
   differential, cancellation/deadline cleanup, and independent export/startup. Inspect browser
   UI at 390/900/1440, keyboard focus, reduced motion and canonical computed header styles.
4. Review exact diff and retained hashes; full Node matrix/brand checks; commit, push, PR and
   required CI. After passing review/CI merge and synchronize the D checkout to main. Inspect
   actual GitHub README desktop/mobile and capture deliverable screenshots.

## Decisions and stop conditions

Reuse the canonical CSS and SVG byte-for-byte, with a provenance/hash inventory rather than a
second design-token source. Use Node's HTTP/process/file APIs and installed Playwright. The Demo
has explicit local target configuration and one run at a time; it cannot execute arbitrary commands.
Historical bundle verification and current-run verification have separate contracts: a new run
must not copy historical successes or claim the full historical/baseline gate.

Bound readiness, execution, process output and cleanup. Report observation failures as inconclusive
or execution errors. A cancelled/partial run can have intact evidence without a confirmed differential.
Refuse mismatched revisions, dirty targets, unavailable dependencies or occupied target ports;
preserve the failure record. Do not silently repair or terminate another task's target.

## Progress and completion gate

- [x] P2 and pnpm fix merged and main CI passed.
- [ ] Brand commit, independent asset validation and parent checks.
- [ ] Runnable Demo, meaningful regression tests and current evidence verification.
- [ ] Real differential, lifecycle tests, standalone install and browser acceptance.
- [ ] Review, PR/CI/merge, D main sync and exact delivery record.

Actual commands, observations, screenshots and limits belong in
`harness/context/03-brand-verifiable-demo.md`. Product GO is not a source-merge condition.
