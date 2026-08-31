# ReproLock ExecPlans

For complex features, cross-package changes, significant refactors, security work, or
release work, create a living ExecPlan under `plans/<phase>.md`.

An ExecPlan must be executable by a developer who has only the repository and the plan.
It contains:

1. Goal and user-visible behavior.
2. Current repository state and relevant files.
3. Non-goals.
4. Product and architecture invariants affected.
5. Proposed design and alternatives rejected.
6. Security and privacy analysis.
7. Exact files allowed to change.
8. Milestones in dependency order.
9. Verification commands and expected observable behavior.
10. Failure, blocked, and inconclusive conditions.
11. Rollback and cleanup.
12. Decision log.
13. Progress log with timestamps and actual evidence.

Rules:

- Keep the plan current while implementing.
- Never mark a milestone complete merely because code exists.
- Record actual command-output summaries and link durable evidence.
- If evidence contradicts the design, update the plan before continuing.
- Prefer a smaller working vertical slice over broad scaffolding.
- Continue through approved milestones without asking for routine next steps.
- Stop only when acceptance criteria pass or a documented hard blocker makes the phase
  blocked or inconclusive.
- Keep task-specific evidence in `harness/context/<phase>.md`; do not turn the plan into a
  second build log.

See `plans/README.md` for naming and lifecycle conventions.
