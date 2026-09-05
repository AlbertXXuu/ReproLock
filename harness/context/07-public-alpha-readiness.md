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

## Publication state and remaining gates

- Local engineering and independent-checkout gates are complete. The product decision remains
  `SPIKE_CONDITIONAL`; no evidence establishes automatic generation, saved effort, lower
  maintenance cost, authenticated provenance or production support.
- Remaining sequence: push `codex/public-readiness`, create a PR, pass both Node CI jobs, record the
  immutable PR/CI links, enable available GitHub security/branch controls, merge, and fast-forward
  the saved D-drive checkout to remote `main`.
- Repository visibility remains private. Every historical commit before this task exposes the
  owner's Outlook author email, and one superseded commit contains a local D-drive experiment path.
  No credential signature was found and this task uses the GitHub noreply identity. The final
  visibility change requires an explicit decision to accept that historical metadata without
  rewriting evidence-bound Git history.
