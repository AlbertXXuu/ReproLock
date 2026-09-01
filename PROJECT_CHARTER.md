# ReproLock Project Charter — Functional QA Scope

## Product thesis

A functional bug report often contains enough intent for a human to understand the problem but not enough structure for a durable automated test. A browser recorder captures actions but often misses the actual business outcome. ReproLock bridges that gap.

It should:

1. accept a user-supplied functional issue snapshot or recorded workflow;
2. explore only a local, explicitly supplied test application;
3. propose candidate actions and candidate outcomes;
4. verify the result through an independent deterministic oracle;
5. minimize unnecessary steps;
6. compile the result into a plain Playwright test;
7. prove the test distinguishes a pre-fix revision from a post-fix revision;
8. preserve a small, inspectable evidence bundle.

## Primary user

A maintainer of a web application who has:

- a reproducible functional regression;
- a local development setup;
- a known pre-fix and post-fix revision;
- a desire to turn the report into a stable test without keeping an LLM in CI.

## Jobs to be done

- “Turn this issue into a test I can review.”
- “Show me the first business outcome that stopped being true.”
- “Prove the generated test fails before the fix and passes after it.”
- “Remove exploratory noise and keep only necessary actions.”
- “Give me a normal Playwright file even if I stop using ReproLock.”

## Non-goals

The MVP is not:

- a general autonomous QA agent;
- a broad system-assessment product;
- a hosted browser farm;
- a test-management dashboard;
- a broad benchmark;
- a replacement for Playwright;
- a service that explores arbitrary public websites;
- a system that logs into real user accounts;
- a universal agent interface standard.

## Value proposition

Playwright code generation captures *how a user interacted*. ReproLock must add value by making *why the workflow is considered successful* explicit and executable.

The project is only differentiated when it can show:

- independent outcome verification;
- pre-fix/post-fix differential evidence;
- step minimization;
- repeated stability;
- readable standalone output;
- clear `inconclusive` handling when the result cannot be observed.

## Product pipeline

```text
User-supplied issue snapshot or workflow
    ↓
Local target scope validation
    ↓
Candidate exploration
    ↓
Independent outcome oracle
    ↓
Repeated confirmation
    ↓
Step minimization
    ↓
Plain Playwright compilation
    ↓
Pre-fix FAIL / post-fix PASS
    ↓
CI-ready regression test + evidence summary
```

## Evidence standard

The source of truth is not a model statement or a screenshot alone. It is the combination of:

- exact target revision;
- exact local start/reset configuration;
- structured attempts;
- executable outcome checks;
- generated test source;
- repeated replay results;
- deterministic summary and manifest.

## Stage gates

### Spike GO

- user supplied the target and both revisions;
- human/deterministic baseline confirms the functional difference;
- one generated plain Playwright test fails on pre-fix and passes on post-fix;
- both sides are stable across 20 runs;
- the oracle does not use model self-report;
- the output is meaningfully better than a simple recorder baseline.

### Production v0.x

- fresh install works;
- local fixture and one user-selected real case both work;
- replay has no model dependency;
- package and GitHub Action have bounded, documented behavior;
- an independent reviewer can reproduce the evidence.

### v1.0

Do not plan v1.0 until at least one external maintainer keeps the generated test or CI integration in a real project and external feedback has changed the product contract.
