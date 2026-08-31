# Repository Layout

- **Status:** Wave 0 foundation baseline
- **Applies from:** 2026-09-01

The repository is organized around evidence-producing phases, not a speculative package graph.
During Wave 0, `packages/`, `examples/`, and `spikes/` are reservation points with policy
READMEs; they do not imply that production modules or product capability exist.

## Foundation layout

```text
reprolock/
├─ AGENTS.md                         repository-wide engineering rules
├─ PROJECT_CHARTER.md                product mission, invariants, scope, and Gates
├─ PLANS.md                          ExecPlan protocol
├─ CONTRIBUTING.md                   contributor workflow and validation
├─ SECURITY.md                       reporting and trust-boundary policy
├─ README.md                         candidate status and entry point
├─ docs/
│  ├─ adr/                           accepted technical decisions
│  └─ foundation/                    repository and collaboration policy
├─ plans/                            one living ExecPlan per substantial task
├─ harness/
│  ├─ build-log.md                   central integration history
│  └─ context/                       phase-local decisions, commands, and evidence
├─ packages/                         gated production packages
├─ examples/                         gated runnable examples
├─ spikes/                           falsifiable investigations
└─ tests/                            cross-package/integration tests when justified
```

The toolchain files at the root (`package.json`, `pnpm-workspace.yaml`, the lockfile,
`tsconfig.base.json`, lint/format configuration, `.nvmrc`, and CI workflows) define one
reproducible workspace. Their presence verifies only the repository foundation.

## Sources of truth

| Concern | Source |
| --- | --- |
| Product mission, users, invariants, MVP, non-goals, and maturity Gates | `PROJECT_CHARTER.md` |
| Repository-wide engineering and review rules | `AGENTS.md` |
| Long-running task execution protocol | `PLANS.md` |
| Branch, worktree, ownership, and integration discipline | `docs/foundation/branch-and-worktree-policy.md` |
| Runtime and package-manager versions | `docs/adr/0001-runtime-and-toolchain.md` |
| A phase's actual commands, results, decisions, and open risks | `harness/context/<phase>.md` |
| Cross-phase/release status after integration | `harness/build-log.md` |

Chat history is not a source of truth. If an implementation depends on a decision, acceptance
criterion, or test result, record it in the applicable repository file.

## Directory responsibilities

### `docs/`

Durable product, architecture, security, guide, and decision records. Documents describe verified
contracts and explicitly named hypotheses; they do not count as implementation evidence. ADRs
record a decision, its date, consequences, and supersession path.

### `plans/`

Living ExecPlans for work that spans multiple steps, has meaningful uncertainty, or crosses a
subsystem boundary. A plan records progress and decisions while the work is active. Completion
requires commands and evidence, not a checked box alone.

### `harness/`

Auditable project-execution records. Each phase owns one context file under `harness/context/` and
records the commands actually run, observed results, decisions, unresolved issues, and stable
handoff contracts. Parallel branches do not edit the central build log; the designated integration
phase consolidates accepted results there.

This project-execution harness is distinct from a future product evidence bundle such as
`.reprolock/runs/<run-id>/`. Product evidence format is designed and accepted in later phases.

### `spikes/`

Bounded, falsifiable research used to make a `GO`, `CONDITIONAL GO`, or `NO-GO` decision. Wave 1
owns the Issue-to-Repro, UI-mutation, and WebMCP-parity investigations. Spike artifacts may be
discardable and must not silently become production dependencies.

### `packages/`

Production workspace packages admitted only after the Wave 1 implementation Gate. A new package
must solve a recorded current problem, have a minimum acceptance condition, and own executable
verification. Logical separation does not require physical packages; v0.1 should consolidate
contracts, core, evidence, and compiler code when separate packages add no present value.

### `examples/`

Small, installable, runnable examples that prove a documented product path after the applicable
Gate. Examples are not adopter evidence, and tailored fixtures are not presented as arbitrary-app
capability.

### `tests/`

Cross-package or end-to-end verification that cannot live beside its owning code. Unit and
package-local tests remain with the package they verify. Generated regression tests must be plain
Playwright tests and must not import ReproLock packages.

## Conditional product topology

The following names are candidate logical boundaries from the architecture baseline, not an
instruction to create empty packages:

```text
contracts/core/evidence/compiler  deterministic contracts and verdict path
playwright                        browser adapter over deterministic contracts
explorer                          provider-neutral candidate generation
cli                               composition root
github/action                     distribution that reuses CLI/core behavior
mutation                          optional; only after the mutation spike supports it
```

The accepted architecture must preserve these dependency rules even if it chooses fewer physical
packages:

- deterministic core logic does not depend on a browser, provider SDK, or GitHub;
- the Playwright adapter depends inward on contracts/core;
- the explorer depends on contracts and a browser port and cannot decide the verdict;
- the CLI is the composition root rather than a second implementation of core behavior;
- a GitHub Action reuses the CLI/core and does not copy product logic;
- replay and generated tests do not depend on an explorer or model provider;
- mutation remains optional/experimental until Spike B supports productization; and
- WebMCP remains a spike and does not enter the MVP package graph.

## Admission rule for new structure

Before adding a directory, package, dependency, public interface, or framework, its task record
must identify:

1. a concrete Issue, reproducible failure, explicit user need, or registered research hypothesis;
2. the location of that evidence;
3. the smallest observable acceptance condition;
4. why an existing module or platform/standard-library capability is insufficient; and
5. the tests or artifact that will verify the change.

Approval covers only the minimum change needed for that problem. Empty extension points and
future-only compatibility layers are removed during review.

## Naming and generated artifacts

- ReproLock remains a working name until the product Gate and naming decision pass.
- Workspace packages, when admitted, use one consistent scope chosen by an accepted architecture
  decision; the Wave 0 directory does not reserve public npm names.
- Evidence, screenshots, traces, caches, and generated tests are written only to explicitly
  documented locations with path-boundary and redaction rules.
- User-generated regression tests belong to the target project and remain ordinary Playwright
  source, not opaque ReproLock data.

## Change rule

A layout change updates this document in the same reviewed branch, states the observed problem it
solves, and preserves the relevant source-of-truth links. Moving code for aesthetic symmetry is
not sufficient reason.
