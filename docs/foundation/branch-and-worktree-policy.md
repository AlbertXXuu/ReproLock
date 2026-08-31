# Branch and Worktree Policy

- **Status:** Required collaboration policy
- **Applies from:** 2026-09-01

Every Codex task uses an exclusive Git branch and an exclusive Git worktree. Two active tasks must
never share a working directory, and no task may modify paths outside its written ownership scope.
This is the mechanism that makes parallel work reviewable; chat memory is not coordination.

## Non-negotiable rules

1. Start every task with `git status --short --branch`.
2. Confirm that the reported branch matches the assigned branch before reading task-local state or
   changing files.
3. Read the applicable `AGENTS.md`, `PROJECT_CHARTER.md`, `PLANS.md`, accepted ADRs, task prompt,
   and predecessor phase context.
4. Record an explicit allowlist of writable paths. Treat every other path as read-only.
5. Preserve unrelated tracked, untracked, and ignored user work. Do not reset, clean, move,
   overwrite, or include it in the task.
6. Use a phase-local ExecPlan and `harness/context/<phase>.md` for substantial work.
7. Run the task baseline before changes and the acceptance commands after changes.
8. End with `git status --short --branch`, `git diff --check`, an ownership-scope check, and a
   handoff that lists actual commands and results.

If the branch, worktree, or ownership scope is wrong, stop modifications and correct the task
assignment. Do not switch an occupied worktree to another task branch.

## Branch and phase map

| Wave | Purpose | Branch |
| --- | --- | --- |
| 0 | Repository foundation | `chore/repository-foundation` |
| 1 | Product and architecture decision | `design/product-architecture` |
| 1 | Real Issue-to-Repro Spike A | `spike/issue-to-repro` |
| 1 | UI mutation Spike B | `spike/ui-mutation` |
| 1 | WebMCP parity Spike C | `spike/webmcp-parity` |
| 2 | Deterministic core and CLI | `feat/deterministic-core` |
| 2 | Agent explorer and minimization | `feat/agent-explorer` |
| 2 | GitHub integration | `feat/github-integration` |
| 2 | Mutation productization, if admitted | `feat/mutation-engine` |
| 2.5 | AlvenX active homepage/content | `site/active-homepage` |
| 3 | External project case study | a dedicated case-study branch/worktree |
| 3 | Security and quality audit | `audit/security-quality` |
| 3 | Final integration/release decision | `release/integration` |

The three legacy-project adoption tasks run in separate branches and worktrees in their own
OpenMultimodalLab, BrowserAgentRegression, and PhysGauge repositories. They never share this
repository's worktree.

## Wave dependencies

```text
Wave 0 foundation
  -> reviewed merge to main
  -> Wave 1 architecture + Spikes A/B/C in parallel
  -> human evidence review
  -> Wave 2 only if architecture >= CONDITIONAL GO and Spike A = GO
  -> external case + independent audit
  -> release/integration decision
```

Do not create Wave 2 worktrees merely because Wave 1 branches exist. The Gate is satisfied only by
reviewed evidence recorded in the repository. Spike B and Spike C may be conditional; Spike A must
be `GO`.

## Creating an exclusive worktree

Run worktree administration from a clean, non-task checkout after the required predecessor is
merged. Resolve the target path before creating it; never reuse a directory held by another task.

```bash
git fetch --all --prune
git status --short --branch
git worktree list
git worktree add ../reprolock-architecture -b design/product-architecture main
git worktree add ../reprolock-spike-a -b spike/issue-to-repro main
git worktree add ../reprolock-spike-b -b spike/ui-mutation main
git worktree add ../reprolock-spike-c -b spike/webmcp-parity main
```

Wave 2 worktrees are created from the reviewed Gate baseline, not from an arbitrary sibling
branch. A branch name is unique and remains attached to one worktree while its task is active.

## File ownership

The task prompt provides the authoritative writable-path allowlist. Directory ownership means:

- the owner may modify only the named paths needed for its acceptance criteria;
- sibling branches read accepted contracts but do not edit them to make local work easier;
- shared root configuration has one designated owner per wave;
- a task that discovers a needed out-of-scope change records the dependency and requests it from
  the owning task or integrator; and
- copied fixes across branches are reconciled by the integrator, not independently rewritten into
  shared files.

An allowlisted directory is not permission for unrelated cleanup or refactoring. The repository
rule requiring a recorded current problem and minimum acceptance condition still applies.

## Plans and phase records

Substantial tasks maintain two complementary records:

- `plans/<phase>.md` is the living execution plan: progress, decisions, discoveries, and recovery
  steps; and
- `harness/context/<phase>.md` is the evidence handoff: created content, commands actually run,
  observed results, unresolved issues, and stable contracts for successors.

Parallel branches write only their own plan and context file. They do not edit
`harness/build-log.md`. Wave 0 creates the central log structure once; the designated integration
phase later consolidates reviewed phase outcomes.

## `main` and integration

No parallel implementation task works directly on `main`. The Wave 0 branch is reviewed and
merged before Wave 1 begins. Later reviewed branches are integrated by the designated integration
owner in dependency order.

The integrator must:

1. verify the source branch and accepted Gate evidence;
2. inspect overlapping files before merging or cherry-picking;
3. resolve contracts intentionally rather than choosing the newest text mechanically;
4. rerun the combined foundation and affected-project checks;
5. update the central build log with observed results; and
6. keep the release unreleased/prerelease when a mandatory criterion is absent.

Merging code does not imply a `GO` decision, package publication, or release authorization.

## Working-tree safety

When `git status --short` shows changes not owned by the current task:

- leave them untouched;
- determine whether they predated the task or belong to another active owner;
- avoid formatters or generators that rewrite those paths;
- stage or hand off only owned files; and
- stop and escalate if owned and unowned changes overlap in the same file.

Destructive recovery commands, broad clean operations, and force pushes are outside the normal
task workflow. The user or designated repository owner must explicitly authorize them against an
exact target.

## Handoff checklist

Every branch handoff reports:

- branch and worktree path;
- changed files, all within the authorized allowlist;
- baseline and final commands exactly as run;
- pass/fail/inconclusive result for each command;
- evidence paths and any redaction performed;
- decisions and accepted contracts;
- unresolved risks, blocked criteria, and dependencies; and
- current `git status --short --branch` plus `git diff --check` result.

Use observed language such as “`pnpm test` exited 0 with 12 tests” rather than “tests should pass.”
An incomplete or inconclusive result remains visible and does not become success during handoff.
