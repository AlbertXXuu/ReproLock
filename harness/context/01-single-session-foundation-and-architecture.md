# Single-session foundation and architecture context

## Scope

- Branch: `reprolock/foundation-architecture`
- Base commit: `5585bd54a02796de380956ca25c72f72794793f4`
- Goal: establish the smallest executable foundation and a current local-functional-QA architecture.
- Non-goals: real target Spike, production feature implementation, external targets/accounts,
  providers, GitHub integration, WebMCP, mutation tooling, dashboard, or package graph.

## Context read

- `AGENTS.md`
- `PROJECT_CHARTER.md`
- `PLANS.md`
- `reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md`
- current package, TypeScript, Biome, CI, repository-layout, branch-policy, contribution, security,
  examples, packages, spikes, and Wave 0 context files
- user-supplied `01_SINGLE_SESSION_FOUNDATION_AND_ARCHITECTURE.md`

## Baseline

| Command | Exit/result | Observable evidence |
| --- | --- | --- |
| `git status --short --branch` | 0 | clean `reprolock/foundation-architecture` at `5585bd5` |
| `pnpm install --frozen-lockfile` | 0 | existing six packages installed from the pinned lockfile |
| `pnpm check` | 0 | format/lint/typecheck passed; Node tests 3/3 passed |
| `pnpm package:smoke` | 0 | package archive smoke passed; 34,553 bytes |

## Decisions

| Time (UTC) | Decision | Evidence and reason | Rejected alternative |
| --- | --- | --- | --- |
| 2026-09-01T09:36:51Z | Use one root TypeScript application and three executable contract proofs. | The clean-start reference rejects a premature monorepo; the current repo has no production consumers. | Empty packages and future adapters. |
| 2026-09-01T09:36:51Z | Treat old Wave 1 branches and scope documents as history, not completion evidence. | They describe public bug discovery, Mutation, and WebMCP, which conflict with the v2 local user-supplied scope. | Cherry-picking old accepted status. |
| 2026-09-01T09:36:51Z | End at architecture/foundation `CONDITIONAL GO` at most. | No user-supplied real target and known pre/post revisions exist yet. | Treating fixture evidence as product readiness. |
| 2026-09-01T09:55:53Z | Use a direct canonical JSON emitter and immutable hard-link publication. | JavaScript enumeration reorders integer-like keys and ordinary assignment loses `__proto__`; hard links give no-overwrite atomic visibility on the executed local filesystem. | Sorted insertion into an ordinary object; overwrite-capable rename. |
| 2026-09-01T09:55:53Z | Make portable path parsing and cleanup failures part of the evidence contract. | Windows ADS/device aliases and Linux backslash semantics otherwise produce host-dependent paths; hidden cleanup failure invalidates functional success. | Host-native path parsing and best-effort cleanup. |
| 2026-09-01T09:55:53Z | Bound fixture close and return one shared promise. | A partial HTTP connection can keep `server.close()` pending and concurrent callers must observe the same cleanup result. | An idle-connection-only close with a boolean flag. |

## Changes

- Foundation contracts: `src/domain/verdict.ts`, `src/evidence/canonical-json.ts`, and
  `src/evidence/writer.ts` define versioned terminal outcomes, stable canonical bytes, portable
  bounded paths, immutable publication, hashes, and visible cleanup failure.
- Executable evidence: `tests/domain/verdict.test.ts`, `tests/evidence/writer.test.ts`,
  `fixtures/loopback/server.ts`, `tests/playwright/loopback.spec.ts`, and `playwright.config.ts`
  cover exact bytes, hostile object/path forms, failed publication cleanup, a user-visible final
  state, active-socket cleanup, one worker, and zero retries.
- Tooling: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `.gitignore`, `.github/workflows/ci.yml`, and `tests/repository-foundation.test.ts` keep one root
  app, pin Playwright `1.62.1`, discover all `*.test.ts`, and install Chromium in both CI runtimes.
- Current scope and architecture: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `docs/adr/0001-runtime-and-toolchain.md`, `docs/foundation/branch-and-worktree-policy.md`,
  `docs/foundation/repository-layout.md`, `examples/README.md`, `packages/README.md`,
  `plans/README.md`, `spikes/README.md`, and
  `reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md` define the serial local route and its gates.
- Historical preservation: `plans/00-repository-foundation.md` and
  `harness/context/00-repository-foundation.md` gained only supersession notices; their recorded
  evidence was not rewritten. This plan and context are the phase-local handoff.

## Observed failures

- An initial 9-test unit run failed only because the manually entered writer SHA-256 golden was
  wrong. The test exposed the mismatch; the expected digest was corrected to the actual canonical
  bytes and all later unit runs passed.
- The first slow-client browser cleanup test failed with `ECONNRESET`: the server correctly forced
  the connection closed, while `events.once` treated the normal reset as rejection before `close`.
  The test now absorbs the expected socket error and awaits `close`; repeated runs pass.
- Independent code and architecture reviews found and then rechecked canonical integer-key and
  `__proto__` collisions, array hidden data, Windows ADS/device paths, cleanup visibility,
  active-socket shutdown, CLI status mapping, reset taxonomy, and gate vocabulary. The final
  reviews report no remaining findings in their assigned scopes.

## Verification

Local final environment: Windows, Node.js `22.23.2`, pnpm `11.19.0`.

| Command/check | Exit/result | Observable evidence |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | lockfile already up to date; completed with pnpm `11.19.0` |
| `pnpm exec playwright install chromium` | 0 | pinned Chromium install/cache check completed without download errors |
| `pnpm check` | 0 | format and lint clean; strict typecheck passed; Node tests 13/13; Chromium 1/1 with zero retries |
| `pnpm package:smoke` | 0 | private non-empty archive smoke passed; installability/publication is not claimed |
| `pnpm audit --audit-level high` | 0 | no known vulnerabilities found |
| Node `22.23.2` / `24.20.0` independent matrix review | pass | final current tree: frozen/offline install and 13/13 discovered unit tests passed on both exact runtimes; the full local check ran on Node `22.23.2` |
| Three independent diff reviews | pass | code/foundation, architecture/docs, and tooling/CI reported no remaining findings after corrections |
| `git diff --check` and owned-path review | pass | no whitespace errors; all 31 changed paths are allowlisted and `harness/build-log.md` is untouched |

## Risks and unresolved items

- A real user-supplied functional regression, exact revisions, trusted start/reset commands, and an
  independent oracle remain required before product `GO`.
- Browser and process support outside the executed Windows/Chromium fixture cannot be claimed from
  this phase alone.
- The checked-in Ubuntu CI job is reviewed but has not yet run remotely on GitHub.
- Package smoke verifies only a private non-empty archive, not installability or publication.
- Atomic publication assumes a coordinator-owned output root outside the target checkout and does
  not defend against a target deliberately racing filesystem entries inside that root.

## Stable handoff

Decision: `CONDITIONAL GO` for foundation and architecture. The phase commit containing this
context is the immutable handoff; its SHA is reported after commit because a commit cannot embed
its own content hash.

The only authorized successor is one serial, user-supplied local functional-regression Spike. It
must not begin until `TARGET_REPOSITORY_PATH`, `ISSUE_SNAPSHOT_PATH`, `PRE_FIX_REVISION`,
`POST_FIX_REVISION`, `START_COMMAND`, and `RESET_COMMAND` are supplied and validated. It must prove
the baseline differential and independent oracle before exploration, then obtain the unchanged
standalone spec's 20/20 pre-fix FAIL and 20/20 post-fix PASS results. This handoff does not authorize
production packages, hosted targets, providers, old Wave 1 branches, `integration/wave1`, or stash
`37728ff`.
