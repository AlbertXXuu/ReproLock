# Spikes

Spikes are bounded, falsifiable investigations that decide whether ReproLock should be built and
which claims it may make. They are not production packages, benchmarks, or a shortcut around the
repository Gates.

Wave 1 starts only after Wave 0 is reviewed and merged. Each spike uses its own branch, worktree,
ExecPlan, writable path, and `harness/context/<phase>.md` record.

## Wave 1 investigations

| Spike | Branch | Question | Decision consequence |
| --- | --- | --- | --- |
| A: Issue to Repro | `spike/issue-to-repro` | Can a real historical public bug become an independently verified, stable plain Playwright test? | Must be `GO` before production implementation |
| B: UI mutation | `spike/ui-mutation` | Is the semantic test robust to irrelevant UI changes and sensitive to broken business outcomes? | May be conditional; gates mutation productization |
| C: WebMCP parity | `spike/webmcp-parity` | Can human UI and agent-facing tools preserve identity, authorization, validation, confirmation, side effects, final state, and error semantics? | Future option; remains outside the MVP |

## Spike A — non-negotiable Gate

Spike A must use a real open-source project's historical issue, exact Bug commit, and exact Fix
commit. Human review establishes the ground truth. The spike then compares an agent-assisted
candidate and semantic oracle with a codegen-style baseline.

A `GO` requires all of the following in one controlled environment:

- public Issue and immutable commit identifiers;
- an oracle independent of agent self-report;
- minimized actions and explicit reset;
- a generated plain Playwright test with no ReproLock runtime dependency;
- Bug commit `FAIL` and Fix commit `PASS`;
- 20/20 replay agreement;
- no LLM call during replay;
- retained, redacted evidence including every attempt; and
- material value beyond a recorded script in oracle quality, minimization, differential evidence,
  or stability.

Spike A cannot return `CONDITIONAL GO`. If any mandatory condition is absent, record `NO-GO` or
`INCONCLUSIVE` and investigate feasibility, bug selection, exploration reliability, oracle
observability, reset cost, or compiler value before broad implementation.

## Spike B — mutation quality

Spike B evaluates both sides of test quality:

- **robustness:** at least three semantic-preserving DOM/UI changes should not fail the semantic
  test; and
- **sensitivity:** at least three semantic-breaking changes must fail it.

Report false positives and false negatives and compare with a codegen-style test. Fixture mutation
capability is labelled as fixture capability, not generalized to arbitrary applications. Only
accepted evidence may authorize an optional mutation package.

## Spike C — UI/WebMCP parity

Spike C compares the same operation through a human UI and an agent-facing WebMCP tool across:

- user identity and authorization;
- validation and confirmation;
- side effects and final state; and
- error classification and recovery semantics.

The result informs a possible future extension. It must not introduce WebMCP dependencies or
claims into the MVP.

## Evidence and safety requirements

Every spike declares its hypothesis, environment, fixtures, reset, oracle, attempts, raw results,
limitations, and decision rule before interpreting success. It retains negative results and
visible retries.

Issue text, repository content, Web pages, traces, and model output are untrusted. A spike never:

- executes a command copied from Issue/page/model text without a separately trusted allowlist;
- exposes cookies, authorization headers, tokens, passwords, full sensitive HAR data, or absolute
  user-home paths in evidence;
- treats model output or screenshot similarity as the final oracle;
- maps setup/error/inconclusive states to product failure or success; or
- silently promotes disposable spike code into a production package.

## Handoff

Each spike ends with `GO`, `CONDITIONAL GO`, `NO-GO`, or `INCONCLUSIVE`, the exact acceptance table,
commands and results, evidence paths, unresolved risks, and what a successor may safely rely on.
Only reviewed evidence—not code volume or narrative confidence—opens the next phase.
