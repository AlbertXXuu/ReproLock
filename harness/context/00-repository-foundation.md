# Phase Context 00 — Repository Foundation

- Status: `in_progress`
- Date: `2026-09-01`
- Branch: `chore/repository-foundation`
- Base commit: `092ff412e5a7ae8b2ecb532b0cb7deecd72477aa`

## Source and authorization

The owner supplied the original prompt artifacts directly. Only content-addressed identity is kept
here; temporary local preview paths are intentionally excluded from repository evidence.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `AlvenX_ReproLock_Codex_Prompt_Pack.zip` | 83,204 | `cf5e9cbf8e259d1e5dfca5b6684e1619f75d021e73c95a1e1b2777ce5f9c903e` |
| `AlvenX_ReproLock_Codex_Multi_Conversation_Prompt_Pack.md` | 83,465 | `7007415a7356a25d1982304f50605f88055365f02aae2c6b4410e43c10fea515` |

Wave 0 follows `prompts/00_repository_foundation.md` plus the supplied Charter, topology,
architecture/acceptance, Plans, and Agents references. Parent-workspace decision D-033 authorizes
this staged, local, non-public foundation without declaring the product Gate passed.

## Baseline

- The parent AlvenX workspace is intentionally not a Git repository.
- OpenMultimodalLab, BrowserAgentRegression, PhysGauge, and AlvenXWebsite were on clean `main`
  worktrees before this phase; none is modified by Wave 0.
- Parent validation before registration: brand revision `2026-08-24.1`; workspace revision
  `2026-08-30.1`; four independent repositories; exit `0`.
- `projects/ReproLock` did not exist before owner authorization.
- Local tools: Node `v22.23.2`, npm `10.9.8`, pnpm `11.19.0`, Git
  `2.55.0.windows.5`.
- Registry versions observed during toolchain selection: pnpm `11.24.0`, TypeScript `7.0.2`,
  `@types/node` `22.20.1` on the Node 22 line, and Biome `2.5.11`.
- Official Node pages checked on 2026-09-01 identify `v24.20.0` as the latest download on the
  Active LTS v24 line and `v22.23.2` on the Maintenance LTS v22 line. The repository pins
  24.20.0 as primary and tests 22.23.2 as minimum.

## Created foundation

- Governance and product truth: `AGENTS.md`, `PROJECT_CHARTER.md`, `PLANS.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, and `README.md`.
- Collaboration evidence: `plans/README.md`, `plans/00-repository-foundation.md`,
  `harness/build-log.md`, `harness/context/README.md`, and this phase context.
- Foundation decisions: `docs/foundation/repository-layout.md`,
  `docs/foundation/branch-and-worktree-policy.md`, and
  `docs/adr/0001-runtime-and-toolchain.md`.
- Minimal directory skeleton: policy-only `packages/README.md`, `examples/README.md`, and
  `spikes/README.md`; no product package exists.
- Reproducible toolchain: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `tsconfig.base.json`, `biome.json`, `.nvmrc`, `.editorconfig`, `.gitignore`, and
  `.gitattributes`.
- Executable foundation checks: `tests/repository-foundation.test.ts`,
  `scripts/package-smoke.mjs`, and `.github/workflows/ci.yml`.

## Key decisions

1. Keep ReproLock as a provisional work name and a non-core, non-public local repository.
2. Put all repository-specific governance inside the independent Git repository; do not turn the
   AlvenX workspace root into Git.
3. Create one private root workspace package and README-only directory placeholders; do not create
   empty product packages.
4. Use strict TypeScript, Biome, and Node's built-in test runner for the smallest sufficient
   validation stack.
5. Keep issue intake, Playwright, oracles, agents, compilers, evidence runtime, and GitHub product
   integration out of Wave 0.
6. Use Apache-2.0 because the owner did not specify another license and existing AlvenX projects
   use the same license; the normalized text was compared with BrowserAgentRegression.
7. Align `@types/node` with the Node 22 minimum, even though Node 24 is canonical, so type checking
   cannot admit APIs unavailable at the declared lower bound.
8. Set checkout `persist-credentials: false`; later tests do not need a retained Git credential.

## Commands and results

### Source and baseline inspection

```text
Get-Content <owner-supplied pasted-text>                         exit 0
Inspect ZIP entries and read prompt 00 plus five references     exit 0
Get-FileHash -Algorithm SHA256 <prompt artifacts>               exit 0
git status --short --branch (AlvenX root)                       expected: not a Git repository
python -B operations/tools/validate_workspace.py                exit 0; 4 repositories
node --version                                                  v22.23.2
npm --version                                                   10.9.8
pnpm --version                                                  11.19.0
pnpm view pnpm/typescript/@types-node/@biomejs-biome            exit 0
```

### Repository and worktree creation

```text
git init --initial-branch=main projects/ReproLock               exit 0
git config user.name/user.email (repository-local)              exit 0
git status --short --branch                                     no commits; README untracked
git add README.md && git commit                                 092ff41
git worktree add <isolated-path> -b chore/repository-foundation exit 0
git status --short --branch                                     clean branch baseline
```

The first README add emitted an LF-to-CRLF warning before `.gitattributes` existed. Wave 0 adds an
LF policy and runs `git add --renormalize .`; the final diff check must show no unresolved line-ending
change.

### Foundation verification

```text
corepack install && pnpm --version                              exit 0; 11.19.0
pnpm install                                                    exit 0; lock updated for @types/node 22.20.1
pnpm install --frozen-lockfile                                  exit 0; already up to date
pnpm format:check                                               exit 0; 5 files, no fixes
pnpm lint                                                       exit 0; 5 files, no diagnostics
pnpm typecheck                                                  exit 0
pnpm test                                                       exit 0; 3/3 pass on Node 22.23.2
pnpm package:smoke                                              exit 0; 35,165-byte tgz; cleaned
pnpm check                                                      exit 0 on Node 22.23.2
pnpm audit --audit-level high                                  exit 0; no known vulnerabilities
pnpm dlx prettier@3.6.2 --check .github/workflows/ci.yml        exit 0; YAML parsed and formatted
pnpm dlx node@24.20.0 --test tests/repository-foundation.test.ts exit 0; 3/3 pass
Node 24.20.0 + pinned pnpm: frozen install/check/package:smoke   exit 0; 3/3; 35,165 bytes
Markdown repository-relative link scan                          exit 0; no missing target
Local absolute-path and product-dependency scans                exit 0; none persisted/found
python -B operations/tools/validate_workspace.py (parent)       exit 0; 5 repositories
git diff --check                                                exit 0
```

The first YAML-validation attempt was intentionally retained as a failed attempt:

```text
python -c "from pathlib import Path; import yaml; ..."           exit 1
ModuleNotFoundError: No module named 'yaml'
```

No repository Python dependency was justified for one YAML check. The plan and executed path were
therefore corrected to exact transient `prettier@3.6.2`, which parsed the workflow and exited `0`.
The canonical Node matrix was run by resolving the `node@24.20.0` binary, prepending its directory
to `PATH`, and invoking the pinned Corepack pnpm CLI; both `process.execPath` and the script-level
`node --version` reported `v24.20.0`.

## Stable interfaces for the next phase

Later phases may rely on:

- `AGENTS.md` and `PROJECT_CHARTER.md` as the engineering and product sources of truth;
- `PLANS.md`, phase-local `plans/<phase>.md`, and `harness/context/<phase>.md` as the execution and
  evidence protocol;
- one exclusive branch/worktree and explicit path ownership per task;
- Node `>=22.23.2 <25`, canonical Node `24.20.0`, pnpm `11.19.0`, strict TypeScript, and the root
  `format:check`, `lint`, `typecheck`, `test`, `check`, and `package:smoke` scripts;
- least-privilege CI with read-only repository permission, no persisted checkout credential, fixed
  action commits, frozen install, and Node 22/24 checks; and
- `packages/`, `examples/`, and `spikes/` as gated reservation points, not accepted package APIs.

Wave 0 establishes no Issue, browser, agent, oracle, compiler, evidence-runtime, or GitHub product
contract. A later task must not infer implementation readiness from this foundation.

## Unresolved items and next gate

- No remote or CI run exists; local CI-equivalent validation is authoritative for Wave 0.
- The final clean-clone validation and immutable integration commit are still pending at this point
  in the phase record; the integration evidence commit closes them.
- ReproLock remains a working name and `0.0.0` private package; publication is prohibited.
- Product feasibility, architecture, real Bug/Fix reproduction, mutation quality, and WebMCP parity
  are Wave 1 questions, not claims established here.
- Wave 2 must not start unless Architecture is at least `CONDITIONAL GO` and Spike A is `GO`.
