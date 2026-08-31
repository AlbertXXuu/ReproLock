# ExecPlan Directory

This directory contains living execution plans governed by the root `PLANS.md`.

## Naming

Use one lowercase kebab-case file per approved phase or substantial task:

```text
plans/<phase-or-task>.md
```

Use the same stable phase identifier for the branch context at
`harness/context/<phase-or-task>.md`. Do not create a plan for a trivial, local, reversible edit.

## Lifecycle

1. Create the plan before implementation when `PLANS.md` requires it.
2. Record the baseline, authorized paths, gates, milestones, and verification commands.
3. Update decisions and progress as evidence changes the implementation.
4. On completion or a hard blocker, record the final state and remaining risks; keep the plan as a
   durable decision record.

Plans describe intended and evolving work. Actual command results and evidence belong in the
matching phase context. The integration verdict belongs in `harness/build-log.md`.
