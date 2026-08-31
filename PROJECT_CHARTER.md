# ReproLock Project Charter

- **Charter status:** Foundation baseline, 2026-09-01
- **Product status:** Provisional AlvenX working name; unpublished pre-product candidate
- **Decision stage:** Before the real-historical-bug product Gate

This charter is the product-scope source of truth. Architecture documents may refine how the
mission is implemented, but they must not weaken the invariants or release gates below without an
explicit charter decision supported by new evidence.

## Mission

Build a local-first, open-source developer tool that:

> Turns a messy GitHub bug report or one successful browser workflow into an independently
> verified, repeatable, durable Playwright regression test that can run in ordinary CI.

The generated test must remain readable, maintainable, and directly runnable after the user stops
using ReproLock.

## Product hypothesis and current evidence boundary

The repository does not yet establish that this product works. Wave 1 must test two central
hypotheses:

1. agent-assisted exploration can turn a real, non-tailored historical browser bug into a useful
   candidate workflow; and
2. independent outcome verification, minimization, and Bug/Fix differential evidence produce a
   materially stronger regression test than a recorder or codegen-style script alone.

Until the real-bug spike passes, architecture, scaffolding, or internally designed fixtures are
not product validation.

## Core users and problem

The first users are developers who maintain open-source or small-to-medium Web applications,
already use or are willing to use Playwright, and face vague bug reports, hard-to-reproduce UI
failures, or regressions in agent workflows.

Their problem is not merely a lack of test code. A recorded interaction can show what was clicked
without proving which business outcome failed, whether the environment was reset, or whether the
same test distinguishes the Bug commit from the Fix commit. A stochastic agent can explore, but
its statement that it succeeded is not durable evidence.

### Jobs to be done

When given a bug report or a known-good browser workflow, a user needs to:

- identify a minimal, repeatable sequence that reaches the relevant state;
- state the expected business outcomes as observable checkpoints;
- locate the first violated outcome without claiming an unproved root cause;
- distinguish a product failure from setup, observability, policy, or infrastructure failure;
- compile the confirmed sequence and oracle into a plain Playwright test;
- prove the test fails on the Bug commit and passes on the Fix commit; and
- retain enough redacted evidence for another person to audit or rebuild the result.

## Magic moment

```text
Input:
“After changing notification settings and refreshing, the selection is lost.”

Output:
Reproduction confirmed
Replay reliability: 20/20

First violated outcome:
notification_preference_persisted

Generated:
tests/reproductions/issue-412.spec.ts

Differential validation:
bug commit: FAIL
fix commit: PASS
```

The magic is not that an agent clicks the right elements once. It is that a reviewer receives a
stable test, an independent verdict, and inspectable differential evidence.

## Product invariants

These constraints are non-negotiable unless this charter is explicitly replaced.

1. **The Agent is not the judge.** It may propose actions, preconditions, outcomes, or oracle
   candidates. `agentResult.success` can never establish `PASS` or a confirmed reproduction.
2. **The durable regression path is deterministic.** Final replay, pull-request checks, and
   long-running CI do not call an LLM or require a provider SDK.
3. **The final business state is independently verified.** Screenshots, agent prose, and the last
   click are not authoritative. An executable oracle must check observable DOM/accessibility,
   URL, storage, network, back-end, or trusted user-provided state.
4. **Uncertainty stays explicit.** A missing precondition, failed reset, unobservable state, or
   non-distinguishing Bug/Fix result is `INCONCLUSIVE` or `ERROR`, never a confirmed result.
5. **The generated artifact has standalone value.** It is a normal Playwright test and does not
   import a private or ReproLock-specific runtime.
6. **Evidence is auditable.** Runs retain versioned manifests, commits, environment and config
   hashes, every attempt, oracle verdicts, replay statistics, redaction reports, and content
   hashes. Failed attempts and retries are visible.
7. **Execution is local-first, least-privilege, and redacted by default.** Cookies,
   authorization headers, tokens, passwords, complete sensitive HAR data, and absolute user-home
   paths are not recorded by default. Exceptions require explicit opt-in.
8. **Real value precedes platform expansion.** Before a real historical Bug commit `FAIL` / Fix
   commit `PASS` proof exists, the project does not build a dashboard, marketplace, generic Agent
   platform, or Agent ABI standard.

## Product pipeline

```text
Issue text or successful recording
  -> trusted-project preflight
  -> agent-assisted exploration
  -> candidate actions and outcomes
  -> independent deterministic oracle verification
  -> reset and repeated reproduction
  -> precondition and action minimization
  -> compilation to a plain Playwright test
  -> replay reliability validation
  -> Bug/Fix differential validation
  -> optional mutation-quality validation
  -> evidence bundle and optional GitHub check/PR summary
```

Trust changes at each boundary. Issue text, repository content, Web pages, traces, and model output
are untrusted input. Only a policy-allowed action executed in a controlled environment and checked
by an independent deterministic oracle may contribute to the verdict.

### Required result semantics

The formal schemas belong to the accepted architecture, but every phase preserves these meanings:

- verdicts: `PASS`, `FAIL`, `INCONCLUSIVE`, `ERROR`, `CANCELLED`, and `POLICY_DENIED`;
- reproduction classifications: `CONFIRMED_REPRODUCTION`, `NOT_REPRODUCED`,
  `INCONCLUSIVE_ENVIRONMENT`, `INCONCLUSIVE_OBSERVABILITY`,
  `INCONCLUSIVE_NONDETERMINISM`, `SETUP_FAILED`, and `POLICY_DENIED`; and
- differential classifications: `BUG_FAIL_FIX_PASS`, `BUG_PASS_FIX_PASS`,
  `BUG_FAIL_FIX_FAIL`, `BUG_PASS_FIX_FAIL`, and `INCONCLUSIVE`.

`ERROR` is not `FAIL`; `INCONCLUSIVE` is not `PASS`. Only `BUG_FAIL_FIX_PASS` supplies the ideal
differential evidence. An anomalous or non-distinguishing classification triggers investigation
rather than being coerced into confirmation.

## MVP

The minimum useful product includes:

- local issue-text intake, followed by GitHub Issue URL intake through an immutable snapshot;
- local application launch with explicit health/readiness checks;
- isolated Playwright `BrowserContext` execution;
- oracle support for DOM/role/text/value, URL, local/session storage, summarized network
  request/response data, and a trusted user-supplied HTTP state check;
- ordered outcome checkpoints and the first violated outcome;
- explicit verdict and reproduction classifications that keep `FAIL`, `ERROR`, and
  `INCONCLUSIVE` distinct;
- reproducible reset followed by repeated reproduction and action minimization;
- compilation to a plain Playwright test;
- Bug-commit failure and Fix-commit success validation in a controlled environment;
- versioned JSON and Markdown evidence, screenshots/traces where safe, a redaction report, and
  SHA-256 content hashes;
- a deterministic/mock path that does not require model credentials; and
- a least-privilege GitHub Action that publishes a summary and evidence artifacts.

The architecture may consolidate contracts, core, evidence, and compiler code in v0.1. Logical
boundaries matter; a large set of packages does not.

## Non-goals for v0.x

- a general autonomous QA agent or a claim to understand every bug report;
- a model benchmark, model leaderboard, or general trace dashboard;
- a large Web studio, SaaS account system, billing, or hosted execution platform;
- simultaneous coverage of Web, desktop, mobile, MCP, and WebMCP;
- screenshot similarity as the sole outcome oracle;
- irreversible activity against production accounts, including purchases, payments, deletions,
  or message sending;
- executing shell commands derived from Issue text or model/page output;
- a universal mutation engine before application-independent capability is demonstrated;
- an Agent ABI standard; or
- packages, abstractions, compatibility branches, or plugin points created for hypothetical use.

## Maturity and release gates

Each gate is evidence-based. Internal implementation volume, documentation volume, or an agent's
success report cannot substitute for a criterion.

### Wave 1 implementation gate

Wave 2 production work opens only when:

- the product/architecture review is at least `CONDITIONAL GO`;
- Spike A is `GO` rather than conditional;
- a public Issue and exact Bug/Fix commits are recorded;
- an oracle independent of agent self-report confirms the outcome;
- the generated artifact is a plain Playwright test;
- it produces Bug `FAIL` and Fix `PASS` in the same controlled environment;
- replay is consistent 20/20 with no LLM call;
- evidence contains no credential leak or arbitrary-command path; and
- comparison shows material value beyond a codegen-style recording.

Spike B (mutation quality) and Spike C (WebMCP parity) may be conditional. Spike A may not. A
`NO-GO` or incomplete Spike A stops broad implementation and requires investigation of product
feasibility, bug selection, oracle observability, reset cost, or implementation strategy.

### v0.1 vertical slice

All of the following must hold at once:

- one real, public, historical open-source bug;
- stable reproduction on the Bug commit and no reproduction on the Fix commit;
- one generated plain Playwright test;
- 20/20 replay agreement in the same environment;
- no model call in replay;
- a verifiable evidence bundle; and
- no leaked test credential.

### v0.x usable product

- install-first use through `npx` or an equivalent entry point;
- after the target app is running, an unfamiliar developer obtains a first result within ten
  minutes;
- the core configuration is approximately 20 lines or fewer;
- at least one real project not tailored for ReproLock completes integration;
- at least one external user independently installs and runs it; and
- external feedback causes a documented API or contract change.

### v1.0

Version 1.0 is permitted only after:

- an external repository continuously retains a generated test or CI check;
- an external user repeats use beyond a one-time trial;
- schema, CLI, output, and upgrade compatibility commitments are explicit;
- observed false-positive and false-negative experience changes the product; and
- security and upgrade practices have survived public versions.

Until then, the project remains unreleased, `0.0.x`, or prerelease as appropriate. Formal naming
and publication are separate decisions made after the applicable Gate.

## Success measures

The primary measures are outcome and adoption evidence, not generated-code volume.

| Stage | Measure | Required signal |
| --- | --- | --- |
| Feasibility | Real historical differential | Bug `FAIL`, Fix `PASS` |
| Reliability | Same-environment replay | 20/20 consistent |
| Independence | Replay model calls | 0 |
| Durability | Generated test runtime | Plain Playwright; no ReproLock import |
| Auditability | Required evidence files | Versioned, hashed, redacted, failed attempts retained |
| Time to value | First unfamiliar-user result | Within 10 minutes after app readiness |
| Configuration | Core configuration | Approximately 20 lines or fewer |
| External validity | Non-tailored integrations | At least 1 |
| Adoption | Independent external installs | At least 1 before usable-product claim |
| Retention | External repository keeps test/CI | At least 1 before v1.0 |

False confirmations, false positives, false negatives, reset failures, setup errors, hidden retry
pressure, and user edits required to keep generated tests running must be measured and reported,
not averaged into a single success rate.

## Fundamental risks and stop conditions

| Risk | Evidence needed | Stop or adjust when |
| --- | --- | --- |
| Agent exploration is too unreliable | Repeated real-bug attempts and retained traces | It cannot produce reviewable candidates within bounded time/actions |
| The target state is not independently observable | Executable oracle on Bug and Fix states | Confirmation depends on agent prose or screenshot interpretation alone |
| Reset is incomplete or too costly | Explicit reset contract and repeat runs | Runs contaminate one another or 20/20 requires hidden retries |
| The test has no advantage over recording | Side-by-side codegen-style baseline | Oracle, minimization, differential, or robustness adds no material value |
| Generated tests are flaky | Replays under the same declared environment | Stability comes only from added waits or retries |
| Untrusted input reaches execution | Threat tests and command/process review | Issue/page/model text can drive arbitrary shell or code execution |
| Evidence leaks secrets or cannot be rebuilt | Redaction tests, hashes, environment metadata | A bundle exposes credentials or omits facts needed for review |
| Scope exceeds one-person maintenance | Package/dependency and operational review | New surfaces do not resolve a recorded current problem |
| External adoption does not materialize | Fresh installs and maintainer feedback | Only tailored internal fixtures demonstrate value |

When evidence is insufficient, choose a small reversible experiment that can falsify the
hypothesis. Do not lower a Gate to preserve the original narrative.

## Relationship to existing AlvenX projects

OpenMultimodalLab, BrowserAgentRegression, and PhysGauge remain separate, stable/maintained
projects. ReproLock inherits three proven disciplines from that work:

- define expected outcomes as executable oracles;
- report the first violated outcome without overstating causality; and
- retain immutable, reviewable evidence.

Those repositories are not ReproLock package hosts, integration sandboxes, or targets for
unbounded feature expansion. Their adoption work is install-first maintenance in their own
repositories. ReproLock must establish its own value through a real external Web bug and may use
the older projects only as documented prior art or independently maintained consumers.

## Decision discipline

- New architecture, packages, dependencies, interfaces, or product surfaces require a recorded
  user need, reproducible failure, Issue, or named research hypothesis plus a minimum acceptance
  condition.
- Product claims cite the applicable evidence and distinguish observed facts from inference.
- A first violated outcome is not called a root cause without separate causal evidence.
- Only the release integration phase may make a release recommendation, and it must preserve an
  unreleased/prerelease result when any mandatory criterion is missing.
