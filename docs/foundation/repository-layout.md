# Repository Layout

- **Status:** Current v2 layout policy
- **Scope:** Local functional QA foundation and the next user-supplied Spike

ReproLock starts as one private TypeScript application. Directories represent current logical
responsibilities only when executable code or a current document uses them.

## Current tree

```text
src/
  domain/       terminal-result and outcome contracts
  evidence/     canonical serialization and bounded atomic writes
fixtures/
  loopback/     synthetic local browser fixture
tests/
  domain/       deterministic contract tests
  evidence/     writer, path, cleanup, and hash tests
  playwright/   loopback user-visible outcome smoke
reference/      current architecture baseline and gates
docs/
  adr/          dated decisions and amendments
  foundation/   repository and worktree rules
plans/          living ExecPlans
harness/
  context/      phase-local evidence handoffs
examples/       admitted local examples only
packages/       dormant until a real physical-package need exists
spikes/         current local Spike protocol
```

## Intended logical boundaries

The smallest vertical slice may add modules for domain orchestration, local runtime supervision,
Playwright adaptation, outcome oracles, evidence, minimization, standalone test compilation, CLI,
and an optional future explorer boundary. Dependencies point inward:

- domain and evidence contracts do not import Playwright, Git hosting, or provider SDKs;
- browser and runtime adapters implement explicit ports;
- explorer output is untrusted candidate data and cannot produce a verdict by itself;
- CLI is the imperative composition root;
- replay and generated tests do not depend on a provider or ReproLock runtime.

Logical names do not reserve directories or packages. Add a path only when a current caller and an
acceptance test require it. Two independently useful packages with separate release needs are the
minimum evidence for a multi-package layout.

## Sources of truth

Within repository sources of truth, authority descends from:

1. `AGENTS.md`;
2. the user's current phase request, only where it is compatible with the repository scope;
3. `PROJECT_CHARTER.md`;
4. `reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md`;
5. the current phase ExecPlan and context;
6. current foundation policies and accepted, non-superseded ADR decisions.

Old Wave 0 records preserve observations. Old branches and pre-v2 plans do not authorize current
scope, prove product gates, or override the files above.

## Admission rule

A new directory, dependency, interface, or framework requires a recorded issue, reproducible
failure, explicit user need, or bounded hypothesis; its evidence location; its smallest observable
acceptance condition; and why existing code or the platform is insufficient. Empty extension
points and future-only compatibility layers are removed.

Generated evidence and tests use explicit output roots, portable relative paths, stable ordering,
redaction, and bounded growth. User-generated Playwright source remains ordinary target-project
code, not an opaque ReproLock artifact.
