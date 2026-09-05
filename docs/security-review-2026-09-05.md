# Security review — 2026-09-05 public alpha

## Decision and scope

This review covers the TypeScript CLI, evidence parsers, local reference UI, child-process boundary,
GitHub Actions workflow, package archive and public repository surface on the public-readiness
branch based on main `82425fc70296868640facab6b0d932378d8c384b`.

The reviewed scope can be published as experimental source after its required checks pass and the
repository owner accepts the historical metadata disclosure. It is not safe for automatic execution
of code produced by an issue, recorder, model or untrusted contributor. The current alpha requires a
human to complete and review the candidate and to trust both local target worktrees.

## Findings and disposition

| ID | Severity in affected scope | Finding | Disposition |
| --- | --- | --- | --- |
| SEC-01 | High if untrusted code is run | A Playwright candidate is arbitrary Node code. Import-shape checks and the standard-fixture origin guard are not a sandbox; custom launches, process APIs and other clients can escape them. | The alpha `init` path writes inert input plus an incomplete marker and never auto-runs it. `check` rejects the marker. Help, README, generated instructions and security policy require human review and call candidate/targets trusted executable code. A disposable OS sandbox is a future prerequisite for any automatic generation-and-run flow. |
| SEC-02 | High | The reference Demo previously gave target and Playwright children the complete host environment and retained raw stdout/stderr. | `OwnedProcess` now defaults to a restricted runtime allowlist with only explicit extra variables. Both general and reference runs persist output byte counts, hashes and truncation state instead of raw logs. A sentinel regression test proves an unrelated parent secret is absent. |
| SEC-03 | Medium | The frozen Safe Unfollow reference candidate permits any `127.0.0.1` HTTP port and does not guard WebSockets. | Retained as a disclosed limitation because editing the frozen candidate would invalidate its historical evidence. The reference path runs only a maintainer-reviewed fixed candidate against supplied local targets with a restricted environment. The general verifier uses exact-origin HTTP and WebSocket routing and blocks service workers. |
| SEC-04 | Medium | Windows/POSIX process-tree accounting samples descendants. A deliberately detached child that is never observed can escape while cleanup is reported for the observed set. | Terminology and documentation now state “observed process cleanup.” Unknown observed cleanup blocks success. Untrusted execution remains prohibited; OS job objects, cgroups or containers are required before that scope can change. |
| SEC-05 | Medium | The reference Demo evidence CLI and saved-run routes parsed unbounded files and file maps. | The CLI and server now reject non-files and files over 8 MiB before parsing. The verifier accepts only six known paths, at most six manifest entries, 4 MiB per embedded file and 8 MiB total. Oversize and unknown-file tests cover the boundary. |
| SEC-06 | Medium | General runs persisted raw start arguments and process output in local records. | Local configuration and process records now contain revisions, settings hashes, output sizes/hashes and bounded execution data instead. They omit target and candidate-source paths, raw arguments, issue/workflow prose and stdout/stderr. Effective Playwright configs remain private local artifacts; portable exports remain minimized. |
| SEC-07 | Medium | Playwright's default failure output could retain a page snapshot under the caller's local output root. | General runs now set `preserveOutput: "never"`; the minimized reporter remains the evidence source. A real failing-browser regression asserts that no page snapshot or attachment remains. |
| SEC-08 | Medium | Portable Demo evidence originally bound file hashes but did not reject unknown schema fields or every contradiction between final status, report completion, exit code, execution time and cleanup. | The schema now rejects unknown fields at every portable envelope, binds fixed reporter settings, observations and aggregate completion, enforces sequential execution/time windows, and requires final status, diagnostic, deadline, exit and cleanup facts to agree. Regression tests refresh all affected hashes and manifests before proving each contradiction is rejected. |
| PUB-01 | Publication privacy | Existing Git history contains the owner's Outlook commit email and a superseded D-drive experiment path. | No credential signature was found. Future commits use GitHub noreply. History is not rewritten because its commit identities bind evidence and prior reviews. GitHub visibility must not change until the owner explicitly accepts this disclosure. |

## Positive controls verified in review

- Child commands use argument arrays with `shell: false`; no command is derived from issue, page,
  trace or model text.
- Target origins are explicit `http://127.0.0.1:<port>` values. The general verifier embeds that
  validated origin in its guard, so candidate `test.use({ baseURL })` cannot replace the HTTP or
  WebSocket allowlist; service workers are blocked.
- Configuration, candidate, reports, evidence files, served trees, arguments, attempts, deadlines
  and process output have explicit bounds.
- Target revisions, clean state, package/lock files, installed entry and configured ignored build
  trees are fingerprinted before and after execution. Explicit Git status arguments defeat a local
  `status.showUntrackedFiles=no`, non-ordinary index flags are rejected, and the reference Demo reads
  the local origin value without applying global Git URL rewrites.
- Evidence uses canonical JSON, atomic non-overwriting writes and recomputed outcome gates. A stored
  success field, report completion or process exit alone is never authoritative.
- GitHub Actions has read-only repository permission, disables persisted checkout credentials, pins
  actions by full commit and applies a 15-minute job limit.
- The pnpm lockfile audit reported zero known advisories at baseline.

## Repository-history review

A bounded custom scan inspected 410 text blobs among 465 objects reachable from all origin refs. It
looked for common private-key blocks and GitHub, OpenAI and AWS credential signatures; none matched.
One superseded commit contains a local AlvenX experiment path. Historical commits before this task
expose the owner's Outlook author email; this task uses the GitHub noreply identity. This was not a
full entropy scanner: gitleaks and trufflehog were not installed.

Authenticated GitHub review on 2026-09-05 inspected all 10 PR titles/bodies and the 22 completed
workflow logs then available. There were no standalone issues, issue/PR comments, inline review
comments, submitted reviews or downloadable artifacts. The bounded scan found no private-key
blocks, common GitHub/OpenAI/AWS credentials, the historical owner email or owner Windows paths
in that remote surface. Remaining closeout: check the current PR/main CI logs and record their
results in the final receipt.
This signature scan is not proof that arbitrary private data is absent and does not remove the
known Git-history metadata disclosure.

## Required repository settings

While public, private vulnerability reporting must remain enabled and the linked advisory form must
work. Dependabot alerts/security updates should be enabled. Main must reject force pushes and
deletion and require the two Node matrix CI checks through pull requests. Secret scanning and push
protection should be enabled wherever the account/repository plan exposes them. Default Actions
token permissions remain read-only.

Before [PR #10](https://github.com/AlbertXXuu/ReproLock/pull/10) merged, Dependabot alerts and
automated security fixes were enabled and read back. Main protection requires up-to-date Node
22.23.2/24.20.0 checks from GitHub Actions, PRs and resolved conversations, also for administrators;
force pushes and deletion are disabled. The single-maintainer policy has zero additional required
GitHub approvals. Default Actions permission is read-only and Actions cannot approve PRs.
Private-vulnerability-reporting GET/PUT returned 404 while private, and `security_and_analysis`
was not exposed. Private reporting, secret scanning and push protection must be rechecked when
public controls are available; this review does not claim those settings are enabled.

## Limits of this review

This was source review plus targeted local tests, dependency audit and bounded history scanning; it
was not a penetration test or proof of containment for hostile code. Portable bundles prove internal
consistency, not execution identity. Publishing source does not create production support, package
security guarantees, cross-platform cleanup proof or product `GO`.
