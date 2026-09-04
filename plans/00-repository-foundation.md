# Wave 0 Repository Foundation ExecPlan

> **Historical pre-v2 record.** This file preserves the commands and decisions observed during
> Wave 0. Its public-target, parallel-Wave, package-topology, and successor assumptions were
> superseded by the scoped clean-start baseline and do not authorize current work.

- Status: `complete`
- Branch: `chore/repository-foundation`
- Started: `2026-09-01` (Asia/Shanghai)

## Goal and user-visible behavior

Create a small, independently versioned repository foundation that a new developer can clone,
install, validate, and use as the shared source of truth for later ReproLock worktrees. Wave 0 is
complete when `main` contains the required governance, toolchain, CI, and evidence records with all
documented checks passing.

## Current repository state and evidence

- Owner-provided source: `AlvenX_ReproLock_Codex_Prompt_Pack.zip`, specifically
  `prompts/00_repository_foundation.md` and the five reference files.
- AlvenX decision: `operations/planning/DECISIONS.md#D-033` in the parent workspace.
- Initial repository commit: `092ff412e5a7ae8b2ecb532b0cb7deecd72477aa` on `main`.
- This worktree began clean on `chore/repository-foundation` at that commit.
- Parent workspace validation passed before registration changes with four independent repositories.
- Local runtime baseline: Node `v22.23.2`, pnpm `11.19.0`, Git `2.55.0.windows.5`.
- Official Node pages checked 2026-09-01 report `v24.20.0` as Latest LTS and `v22.23.2`
  as an LTS release.

## Non-goals

- Issue ingestion or parsing
- Browser control or Playwright installation
- Agent/model/provider integration
- Oracle, compiler, replay, evidence-bundle, or GitHub Action product logic
- Dashboard, hosted service, benchmark, public repository, npm publication, or GitHub Release
- Changes to OpenMultimodalLab, BrowserAgentRegression, PhysGauge, or AlvenXWebsite

## Product and architecture invariants affected

Wave 0 records, but does not implement, the product invariants: agents never decide verdicts;
replay is LLM-free; confirmation needs an independent oracle; ambiguity is inconclusive; generated
tests remain plain Playwright; evidence is versioned/hashable/redacted; all intake is untrusted;
platform expansion waits for a real Bug/Fix gate.

The repository foundation itself must remain private/unpublishable, contain no empty packages, use
strict TypeScript, and keep the central build log owned by foundation/integration work only.

## Design and alternatives

1. Use a dedicated `projects/ReproLock` repository. Rejected placing files at the AlvenX root
   because the root is intentionally not a Git repository and its allowlist forbids product files.
2. Use one private root package plus directory README placeholders. Rejected multiple empty
   packages because no observed implementation need establishes their boundaries.
3. Use Node's built-in test runner and one Biome dependency for formatting/linting. Rejected a
   larger test/lint stack because Wave 0 has no product code.
4. Pin Node 24.20.0 as primary while testing the still-supported 22.23.2 minimum. This makes the
   official Latest LTS the default without claiming support for older/EOL versions.

## Security and privacy

- CI has explicit `contents: read`, bounded timeouts, and no secrets or untrusted code execution.
- The package is `private`, version `0.0.0`, and publication is prohibited by policy and metadata.
- No issue/page/model input is processed in this phase.
- The package smoke test writes only to an OS-created temporary directory and removes it in a
  `finally` block.
- Logs must not contain credentials, absolute home paths, or copied environment values.

## Exact file scope

The branch may change only the files listed in `prompts/00_repository_foundation.md` plus the
minimal repository `README.md`, toolchain test/script, Node ADR, skeleton directory READMEs, and
this ExecPlan/phase context. Parent-workspace registration and D-033 are coordinated separately.

## Milestones

1. **Governance source of truth** — AGENTS, Charter, Plans, contribution/security/conduct/license,
   layout/worktree policy, and context/log files exist and agree.
2. **Minimal toolchain** — private pnpm workspace, strict TypeScript, Biome, one foundation test,
   package smoke, pinned Node/pnpm, and lockfile exist without product dependencies.
3. **Least-privilege CI** — fixed action SHAs, Node 22/24 matrix, frozen install, and all checks.
4. **Verification and review** — all commands pass, generated tarball is inspected by the smoke
   script, YAML parses, diff is reviewed, and parent workspace validation passes.
5. **Integration** — branch commit is fast-forward merged into `main`; both repository and parent
   workspace finish clean; N001 evidence is updated.

## Verification commands and expected behavior

```powershell
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm package:smoke
pnpm dlx prettier@3.6.2 --check .github/workflows/ci.yml
git diff --check main...HEAD
python -B ..\..\..\operations\tools\validate_workspace.py
```

Every command must exit `0`. The test must report a real passing test; package smoke must create a
non-empty `.tgz` in a temporary directory and clean it; workspace validation must list five clean
independent repositories after integration.

## Failure and inconclusive conditions

- Any required check cannot run on the supported Node range.
- Completing Wave 0 requires product logic, Playwright, a model SDK, credentials, or a remote.
- Existing frozen projects or evidence would need modification.
- Package/CI metadata could publish accidentally or obtain write permissions.
- The parent workspace cannot validate the registered independent repository.

In these cases keep the repository local, leave N001 incomplete, record the exact result, and do
not start Wave 1.

## Rollback and cleanup

Before merge, the isolated branch/worktree can be abandoned without changing the initial `main`
commit. Parent-workspace registration files are ordinary local files and can be reverted with an
explicit patch if the new repository is rejected. Do not delete or rewrite any frozen project.
After a successful fast-forward merge, remove only the verified clean Wave 0 worktree.

## Decision log

- `2026-09-01`: Treat the owner's supplied prompt pack as direct authorization for Wave 0 only;
  public/product status remains gated.
- `2026-09-01`: Keep ReproLock as a provisional work name and repository directory, not a final
  published brand.
- `2026-09-01`: Support Node `>=22.23.2 <25`, pin `24.20.0` as the primary development version,
  and pin pnpm `11.19.0` to the locally verified package-manager line.
- `2026-09-01`: Align `@types/node` with the Node 22 minimum and disable persisted checkout
  credentials after an independent pre-integration review.
- `2026-09-01`: Replace the unavailable local PyYAML check with exact transient
  `prettier@3.6.2`; retain the failed PyYAML attempt in phase evidence.

## Progress log

- `2026-09-01`: Read the complete Wave 0 prompt and required reference files from the supplied ZIP.
- `2026-09-01`: Audited the parent workspace and all four existing repositories; all were clean.
- `2026-09-01`: Added D-033/N001 and registered the non-core, non-public candidate.
- `2026-09-01`: Created initial `main` commit and isolated `chore/repository-foundation` worktree.
- `2026-09-01`: Governance, charter/foundation docs, and toolchain/CI implementation completed in
  the isolated branch.
- `2026-09-01`: Node 22.23.2 and Node 24.20.0 local matrices passed; independent review findings
  were corrected.
- `2026-09-01`: A fresh clone of implementation commit `12c0c90302e0931dc71933ac0c4971381b054c78`
  passed frozen install, check, package smoke, YAML parsing, audit, diff, and clean-status checks on
  the declared runtime matrix. All Wave 0 milestones are complete.
