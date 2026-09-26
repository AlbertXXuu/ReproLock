# ExecPlan Directory

Multi-step work maintains one living plan under `plans/`, governed by root `PLANS.md`.

Plans `00` through `07` are completed or superseded phase records. Their old branches, release
permissions and external-adoption gates do not dispatch current work. The next engineering scope
is the complete existing-case workflow described in the current README and PROJECT_CHARTER.
Open a new phase plan only for the concrete task being executed; preserve historical evidence.

Use a stable lowercase identifier:

```text
plans/<phase>.md
harness/context/<phase>.md
```

Create the plan before implementation. Keep it current when evidence changes scope, milestones,
decisions, risks, or the gate. A complete plan includes:

- one observable goal;
- writable paths and explicit exclusions;
- trusted user inputs and unknowns;
- exact baseline commands and results;
- milestones with verification, rollback, and stop conditions;
- alternatives and reversible decisions;
- security, privacy, cancellation, cleanup, and data-handling considerations;
- progress, failures, retries, and inconclusive observations; and
- exact completion criteria.

The matching phase context is the durable handoff: commands actually run, artifacts produced,
limitations, stable contracts, and assumptions successors must not make. Historical plans remain
unchanged except for a clear supersession notice when their scope no longer governs new work.
