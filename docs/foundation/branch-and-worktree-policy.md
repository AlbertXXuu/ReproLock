# Branch and Worktree Policy

- **Status:** Current v2 collaboration policy
- **Applies from:** 2026-09-01

Each active implementation phase owns one named branch and one exclusive worktree. Worktrees have
independent checkouts but share repository commits, refs, and stash metadata, so old refs and stash
objects remain read-only unless a separate task explicitly owns them.

## Required start and finish

1. Run `git status --short --branch` and `git rev-parse HEAD`.
2. Confirm the expected base commit, assigned branch, exclusive worktree, and clean status.
3. Read current root instructions, charter, architecture baseline, plan, and predecessor handoff.
4. Record a writable-path allowlist and exclusions.
5. Run and record the pre-edit baseline.
6. Modify only owned paths; preserve unrelated and historical state.
7. Finish with targeted tests, `pnpm check`, package smoke when applicable, `git diff --check`,
   ownership review, and final status.

Never use broad clean/reset commands to resolve task state. A new worktree does not isolate refs,
stashes, or objects. One named branch may be checked out in only one worktree at a time.

## Current serial sequence

```text
main@18b83c0 historical foundation
  -> reprolock/clean-start scoped v2 context
  -> foundation + product architecture
  -> human review
  -> one user-supplied local functional-regression Spike
  -> production-scope decision only if that Spike passes
```

Do not start parallel public-target, Mutation, WebMCP, GitHub integration, dashboard, provider, or
release branches from this line. The old branches with those names remain preserved history and
are not predecessor evidence.

## Plans and records

Substantial phases own `plans/<phase>.md` and `harness/context/<phase>.md`. Parallel read-only
audits may inform the owner, but only the phase owner edits phase files. The central
`harness/build-log.md` remains integration-owned.

## Integration rule

An integration owner verifies immutable source commits, gate evidence, overlap resolution, combined
checks, and remaining conditions. Merging code never implies product `GO`, package publication, or
release authorization. Historical branches are not merged wholesale; useful ideas are revalidated
against current local scope and implemented only when a current caller needs them.

## Handoff

Report branch, base and final commit, changed paths, exact commands/results, artifacts, privacy
handling, decisions, unresolved assumptions, rollback/stop conditions, and final clean status.
Use observed results rather than predictions.
