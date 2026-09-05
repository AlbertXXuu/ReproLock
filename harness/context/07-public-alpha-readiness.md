# Phase context — public alpha readiness

This record is populated from commands actually run. It must not claim product `GO`, automatic
test generation, saved maintainer effort, external adoption or public visibility without evidence.

## Baseline

- Base main: `82425fc70296868640facab6b0d932378d8c384b`.
- Task branch: `codex/public-readiness`.
- Initial D checkout: clean.
- Dependency audit: pnpm reported zero known advisories.
- Public-stage decision: prepare an experimental source alpha around a reviewed-candidate
  differential verifier; retain `SPIKE_CONDITIONAL`.

## Implementation and verification

- Source commit: `24a67ec12464b3a38828bcf89e9405cb811c3e8f`
  (`feat: prepare verifiable public source alpha`). Product Gate records remain in separate commits.
- The public CLI now exposes `--help`, `--version`, `init`, `check`, `run` and `verify`. `init`
  copies bounded UTF-8 issue/workflow files as inert ignored input and creates an unmistakably
  incomplete ordinary Playwright scaffold. `check` rejects that marker and validates two exact,
  clean worktrees, caller-owned output, loopback origin, bounded start arguments and declared
  served trees before execution.
- General execution binds runtime/configuration/source/target hashes, rejects hidden Git index
  state and ignored-tree drift, guards standard Playwright traffic to the exact HTTP/WebSocket
  origin, blocks service workers, removes Playwright failure artifacts, restricts child
  environments, records only bounded output metadata, and keeps replay/model independence.
- The reference Demo now defaults to `127.0.0.1:7872`. Its portable schema rejects unknown fields
  and refreshed-hash contradictions across completion, observations, exit, diagnostic, deadline,
  execution ordering/time windows and cleanup. Historical completed, cancelled and timeout
  records remain unchanged and verifiable.
- README, contribution/security/community files, Apache/OFL notices and brand provenance now expose
  the honest experimental source-alpha entry. The centered AlvenX README header and English Demo
  match the parent registry. The accepted 1440px screenshot is
  `docs/demo-evidence/demo-1440.png`; browser checks also exercised 390px and 900px viewports,
  resource loading, focus, reduced motion, header geometry and arrow accessibility.

Actual local acceptance on the source commit:

- `corepack pnpm check` — passed: 110/110 Node tests, 6/6 Chromium tests, root and standalone
  typechecks, brand verification, Safe Unfollow evidence, three Demo recordings and DrawDB #687
  evidence. Biome reported three non-failing pre-existing style suggestions.
- `corepack pnpm package:smoke` — passed: 140-file working-tree archive after the Gate files were
  present; the immutable source commit alone produced 138 files and 1,095,424 bytes.
- `corepack pnpm quickstart` — passed: DrawDB #687 derived 20 functional failures before the fix
  and 20 passes after it.
- `corepack pnpm audit --json` — zero advisories at every severity across 36 dependencies.
- `python foundation/brand/validate_brand.py` — passed: 22 registered assets, five unified README
  headers, five header-navigation contracts and ReproLock UI resources.
- `python operations/tools/validate_workspace.py` — passed for all five independent repositories.
- `git diff --check` and tracked-index audit — passed; all 129 tracked entries had ordinary `H`
  state. Fifteen changed Markdown files had zero missing local links. Forty-one changed text files
  had zero matches for the historical Outlook address, real user/Codex paths, private-key blocks,
  or common GitHub/OpenAI/AWS credential forms.

Independent acceptance used a Git-managed detached worktree at exactly `24a67ec`, installed from
the frozen lockfile, and passed the same 110 Node tests, six browser tests and all recorded-evidence
checks. Its quickstart and package smoke also passed, its tracked/untracked status was empty, and
Git removed the temporary worktree after confirming only ignored `node_modules/` and test output.
Two independent adversarial reviews reported no remaining P0-P2/public-alpha blocker. Their final
probes refreshed affected hashes and manifests before confirming that seven previously accepted
status/report/cleanup contradictions are now rejected.

## Delivery and publication record

- Local engineering and independent-checkout gates are complete. The product decision remains
  `SPIKE_CONDITIONAL`; no evidence establishes automatic generation, saved effort, lower
  maintenance cost, authenticated provenance or production support.
- The owner explicitly authorized the exact private origin. Authenticated checks outside the
  restricted environment confirmed `AlbertXXuu` and private repository `AlbertXXuu/ReproLock`;
  re-login was unnecessary. Both source and separate Gate commit `328cf13` were pushed unchanged.
- [PR #10](https://github.com/AlbertXXuu/ReproLock/pull/10) passed the required
  [Node 22.23.2](https://github.com/AlbertXXuu/ReproLock/actions/runs/33950828745/job/101265142364)
  and [Node 24.20.0](https://github.com/AlbertXXuu/ReproLock/actions/runs/33950828745/job/101265142325)
  checks. The jobs ran the complete check and package smoke, taking 2m27s and 2m32s respectively.
  GitHub reported a clean, mergeable PR at the exact Gate head before the authorized merge.
- `gh pr merge 10 --merge --match-head-commit 328cf137c1198bd774a040d4b486704fececa478`
  merged at `2026-09-05T06:52:28Z`, producing `874a58f758a1e50de5c695364db64f0a55d26044`.
  `git fetch origin`, `git switch main` and `git merge --ff-only origin/main` synchronized the
  saved D-drive checkout with empty tracked/untracked status. Original source and Gate commits
  remain separate ancestors. The [main workflow](https://github.com/AlbertXXuu/ReproLock/actions/runs/33951007338)
  also passed both Node jobs.
- [PR #11](https://github.com/AlbertXXuu/ReproLock/pull/11) recorded the delivery and remote audit
  after its [two Node checks](https://github.com/AlbertXXuu/ReproLock/actions/runs/33951266368)
  passed. It merged as `b3680f715f43da396084de4df62b60c81bdd98a3`; the saved checkout fast-forwarded
  cleanly to that main and its [main workflow](https://github.com/AlbertXXuu/ReproLock/actions/runs/33951502108)
  passed both Node jobs. Those documentation-only commits do not change accepted runtime source
  `24a67ec`. The separate local delivery receipt preserves this pre-publication snapshot.
- Repository description and topics now identify the experimental local regression verifier.
  Dependabot vulnerability alerts and automated security fixes are enabled. Main protection requires
  the current-base `Node 22.23.2` and `Node 24.20.0` checks from GitHub Actions (app 15368), PRs and
  resolved conversations, including administrators; force pushes and deletion are disabled.
  The single-maintainer policy requires zero additional GitHub approving reviews; it does not
  substitute for the recorded independent implementation reviews. Default Actions permission is
  read-only and Actions cannot approve PRs.
- Authenticated remote-surface review on 2026-09-05 inspected all 10 PR titles/bodies and 22
  completed workflow logs. GitHub returned zero standalone issues, issue/PR comments, inline review
  comments, reviews and downloadable artifacts. The bounded signature/known-owner scan found no
  private-key blocks, GitHub/OpenAI/AWS credential forms, historical owner email or owner Windows
  paths in that surface. It does not replace the separate Git-history disclosure below. Raw remote
  content is not retained in the minimized local audit receipt.
- The final pre-publication remote audit at `2026-09-05T07:07:06.373Z` extended that coverage to
  all 11 PRs and 27 completed workflow logs, with no pending run or downloadable artifact and zero
  matches for the same credential/known-owner signatures. The minimized receipt has SHA-256
  `678c1c6932e5643aa0bca374cba89b74063d7672827fc7bfdc1db900e14dff65`.
- GitHub's private-vulnerability-reporting GET/PUT had returned 404 while private, and repository
  `security_and_analysis` was not exposed then. After publication, private reporting, secret
  scanning and push protection were enabled and read back successfully; no paid feature was enabled.
- Historical `spike/issue-to-repro` worktree and shared recovery stash remain preserved. The
  temporary independent-acceptance worktree was removed through Git after its content audit.
- Historical commits before this task and GitHub's PR #10/#11 merge commits expose the owner's
  Outlook author email. GitHub rejected the explicit noreply merge-author address and used the
  account's allowed default identity; locally authored task commits use GitHub noreply. One
  superseded commit contains a local D-drive experiment path. After this consequence was explained,
  the owner explicitly instructed the task to make the repository public on 2026-09-05. Git history
  and the earlier private-state receipts remain intact.
- `gh repo edit AlbertXXuu/ReproLock --visibility public --accept-visibility-change-consequences`
  exited 0. `gh repo view AlbertXXuu/ReproLock --json isPrivate,url` confirmed `isPrivate: false`.
  An independent anonymous `Invoke-WebRequest` check returned HTTP 200 for both the repository page
  and raw main README; the page identified the repository as Public. README preserved the AlvenX
  header, experimental source-alpha wording and `SPIKE_CONDITIONAL`.
- The private-vulnerability-reporting PUT succeeded and GET returned `enabled: true`. The
  repository PATCH enabled `secret_scanning` and `secret_scanning_push_protection`; read-back
  returned `status: enabled` for both. Dependabot and main protection remained enabled. These are
  configuration checks, not proof that background scans or all possible security reviews finished.

## Resumed publication-record verification — 2026-09-05

`git status --short --branch` and `git rev-parse HEAD` found clean, synchronized published main
`b3680f7`. `gh pr list --state open` returned no open PR; the final main workflow above remained
successful. Fresh repository/security API reads confirmed public visibility, private reporting,
secret scanning, push protection and both required Node checks. The open secret-scanning-alerts
endpoint returned an empty array; this is a point-in-time result, not a guarantee of no secrets.
Before these record edits, `corepack pnpm format:check` and `git diff --check` passed.

The remaining work was confined to three tracked publication records that still described the
private-state checkpoint. The correction preserves prior receipts and leaves runtime source,
product gates, original reports, the historical worktree and shared stash unchanged. Its PR must
pass the existing complete Node 22/24 checks before merge and D-drive main synchronization.
