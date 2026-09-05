# Public alpha readiness

## Goal and authorization

Prepare ReproLock for an honest public-source alpha. A new maintainer must be able to understand
the present capability, create a bounded local case workspace, review and complete an ordinary
Playwright candidate, check two supplied worktrees, run the differential, and independently verify
the portable result. The owner authorized the implementation, validation, commit, PR, CI, merge and
D-drive main synchronization. Changing GitHub visibility remains the last publication action because
the existing Git history exposes the owner's commit email and that consequence must be reviewable.

Public alpha does not grant product `GO`. The issue/workflow-to-finished-test thesis, saved effort,
maintenance benefit and external adoption remain unproven. The fixed Safe Unfollow UI is a reference
case and evidence viewer, not the general product surface.

## Ownership and scope

- Saved checkout: the repository checkout selected in the local AlvenX workspace.
- Sole writer: this task on `codex/public-readiness`, based on main
  `82425fc70296868640facab6b0d932378d8c384b`.
- Allowed: `src/verify/`, its tests, the existing Demo evidence/process boundary, package
  scripts/smoke, public documentation and community health files, this plan and
  `harness/context/07-public-alpha-readiness.md`.
- Reversible GitHub repository metadata and security settings may be updated after the source change
  is accepted. Visibility changes only after the final privacy decision.
- Excluded: model/provider integration, autonomous exploration, target dependency installation,
  commands inferred from issue/page text, hosted services, generic QA/dashboard scope, rewriting old
  evidence, and rewriting Git history.

## Baseline evidence

- D checkout was clean at main `82425fc`; new task branch was clean before edits.
- PR #9 and main CI passed on Node 22.23.2 and 24.20.0.
- Local `pnpm audit --json` reported zero known advisories across all severities.
- A bounded scan covered 410 text blobs in 465 objects reachable from origin refs. It found no
  private-key, GitHub, OpenAI or AWS credential signature. One superseded commit contains a local
  D-drive experiment path; it is not a credential or private target path.
- The private repository had no branch protection/ruleset, vulnerability alerts were disabled,
  default Actions permission was read-only, actions were commit-pinned and the workflow timeout was
  15 minutes.
- Every existing commit uses the owner's Outlook address. Future task commits will use the owner's
  GitHub noreply address without changing historical evidence identities.
- Product audit reproduced that `--help` fails generically, errors are hidden, output is fixed under
  the ReproLock checkout, configuration is hand-authored, and ignored served build bytes are not
  included in the CLI target fingerprint.

## Public alpha contract

1. `init` creates a new case directory without overwriting anything. It copies an explicit issue
   file and optional workflow file as inert data, records their hashes, resolves the two supplied Git
   revisions, and emits a Playwright candidate scaffold plus local configuration and instructions.
2. The scaffold contains an unmistakable incomplete marker. `check` rejects it before application
   startup. The tool never interprets input text as a command or claims to generate a finished test.
3. Configuration rejects unknown keys and uses explicit caller-owned output storage. Paths remain
   bounded outside target worktrees. Optional `servedPaths` binds complete ignored runtime trees
   with stable, bounded file inventories; symlinks and special files are rejected.
4. `--help`, `--version`, `init`, `check`, `run` and `verify` have stable, actionable terminal output.
   Detailed local errors may be printed to stderr; portable exports remain data-minimized.
5. Existing schema-v1 portable evidence remains verifiable. New bundles bind served-path settings
   without invalidating historical records.
6. README, security policy, contribution path and GitHub templates state the real capability,
   trust boundary, limitations, disclosure channel and next adoption gate.

## Milestones and verification

1. Add focused failing tests for config strictness, scaffold safety/idempotence, help/error behavior,
   output-root containment and served-tree fingerprinting; implement the smallest supporting CLI.
2. Preserve the existing real-browser differential, timeout, cancellation, evidence and cleanup
   tests. Add a package/consumer smoke only if the private package can actually expose the CLI
   without a misleading release claim; otherwise document the clone-first entry honestly.
3. Rewrite the README first screen and local verification guide. Add minimal issue/PR templates and
   a dated security/public-readiness review. Keep the exact brand header and product-stage label.
4. Run formatter, lint, brand validation, TypeScript, unit/process and browser tests, recorded
   evidence checks, package smoke, dependency audit and parent AlvenX validators. Inspect generated
   workspace and portable export for paths, secrets and input-text leakage.
5. Validate from an independent clean checkout/archive, then request independent code/security and
   evidence review. Commit, push, create PR, follow both CI jobs, merge after all gates pass, sync
   D-drive main and confirm the main workflow.
6. Configure public metadata and security features that are available while private. Present the
   final version, evidence and historical-email consequence. Change visibility only after that
   publication decision is explicit.

## Stop and rollback conditions

- Do not publish if a clean consumer cannot complete the documented entry path, a portable export
  leaks local/input data, cleanup becomes unknown, a required CI job fails, or the README implies
  automatic issue-to-test generation or measured superiority.
- Any unobservable functional outcome remains `inconclusive`; a non-differential run exits nonzero.
- Remove new abstraction or packaging work if it does not improve the current user path. Preserve
  failed run evidence and old records; revert only this branch's source changes if a gate fails.

## Progress

- [x] Clean baseline, GitHub settings, dependency audit, history scan and product-surface audit.
- [x] Public CLI/case-workspace contract implemented and targeted tests pass.
- [x] Public documentation, security review and community surface complete.
- [x] Full local and independent acceptance pass at source commit `24a67ec`.
- [x] [PR #10](https://github.com/AlbertXXuu/ReproLock/pull/10) passed both required Node CI jobs,
  merged as `874a58f758a1e50de5c695364db64f0a55d26044`, and the saved D-drive main fast-forwarded
  cleanly to that commit. The phase context records immutable remote acceptance links.
- [x] Repository description/topics, Dependabot alerts/security updates and protected-main rules
  configured and read back. Authenticated historical PR/log/artifact review completed.
- [ ] Owner accepts historical metadata disclosure before any visibility change. Recheck private
  vulnerability reporting, secret scanning and push protection when their public controls become
  available; keep the repository private until that decision.
