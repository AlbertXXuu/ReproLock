# ReproLock Architecture and Acceptance Baseline

## Architectural principle

Start as a small TypeScript application with clear modules. Do not create a large monorepo until two independently useful packages genuinely need separate release cycles.

Recommended initial structure:

```text
src/
  domain/
    contracts.ts
    verdict.ts
    state-machine.ts
    minimization.ts
  evidence/
    schemas.ts
    canonical-json.ts
    manifest.ts
    writer.ts
  runtime/
    process-supervisor.ts
    local-target.ts
    reset.ts
  browser/
    playwright-session.ts
    observations.ts
    actions.ts
  oracles/
    dom.ts
    url.ts
    storage.ts
    composed.ts
  compiler/
    playwright-emitter.ts
    selector-policy.ts
    metadata.ts
  explorer/
    protocol.ts
    fake-provider.ts
  cli/
    commands.ts
    output.ts
fixtures/
tests/
examples/
```

## Core contracts

### Verdict

```ts
type Verdict =
  | { kind: "pass"; evidence: EvidenceRef[] }
  | { kind: "fail"; checkpoint: string; evidence: EvidenceRef[] }
  | { kind: "inconclusive"; reason: string; evidence: EvidenceRef[] }
  | { kind: "error"; code: string; message: string };
```

### Attempt lifecycle

```text
planned
→ target_started
→ reset_completed
→ actions_running
→ outcome_checked
→ persisted
```

Every terminal state must distinguish:

- functional fail;
- unobservable/inconclusive;
- setup/runtime error;
- cancellation.

### Outcome contract

An outcome contract describes observable business state, not the model’s intention.

Example:

```yaml
id: notification-preference-persists
checkpoints:
  - id: settings-page-open
    oracle:
      type: url
      matches: /settings/notifications
  - id: preference-selected
    oracle:
      type: dom
      role: checkbox
      name: Product updates
      checked: true
  - id: preference-persists-after-reload
    oracle:
      type: dom
      role: checkbox
      name: Product updates
      checked: true
      after: reload
```

## Evidence bundle

```text
evidence/
  run.json
  attempts.jsonl
  outcome-contract.json
  generated-test.spec.ts
  generated-test.meta.json
  differential-summary.json
  replay-summary.json
  data-handling-report.json
  manifest.json
  report.md
```

Required properties:

- stable ordering;
- explicit schema versions;
- atomic writes;
- relative portable paths;
- hashes for durable files;
- failed attempts preserved;
- no private values or machine-specific data beyond what is needed;
- report rebuildable without a model call.

## CLI baseline

Suggested commands:

```text
reprolock doctor
reprolock validate-config
reprolock capture-issue
reprolock explore
reprolock verify-outcome
reprolock compile
reprolock replay
reprolock compare-revisions
reprolock verify-evidence
```

The CLI must:

- use exit code 0 for successful command and satisfied acceptance condition;
- use exit code 1 for completed functional comparison that does not meet the requested condition;
- use exit code 2 for invalid input or runtime/setup error;
- support `--json` for machine-readable output;
- never hide retries;
- state whether a model was used during exploration;
- state that replay itself is model-free.

## Acceptance baseline

### Product evidence

- exact pre-fix and post-fix revisions;
- one shared generated test;
- pre-fix: 20/20 expected failures;
- post-fix: 20/20 expected passes;
- zero hidden retries;
- exact reset behavior;
- readable result summary.

### Engineering quality

- strict TypeScript;
- formatter and linter;
- unit, integration, and Playwright tests;
- deterministic fake provider;
- local fixture app;
- package-install smoke test;
- Windows and Linux behavior documented honestly;
- process cleanup verified.

### Product truth

Documentation must not claim:

- automatic handling of arbitrary repositories;
- complete understanding of issue text;
- proof of root cause from first failure;
- full autonomy when human setup is still required;
- production maturity based only on fixture evidence.
