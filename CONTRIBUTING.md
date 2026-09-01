# Contributing to ReproLock

ReproLock accepts changes that solve a recorded local-functional-QA problem or test a registered
hypothesis with inspectable evidence.

## Before editing

1. Read `AGENTS.md`, `PROJECT_CHARTER.md`,
   `reference/ARCHITECTURE_AND_ACCEPTANCE_BASELINE.md`, and the applicable phase context.
2. Run `git status --short --branch` and confirm the assigned branch and exclusive worktree.
3. Create or update an ExecPlan under `plans/` for multi-step work.
4. Record the observed problem, writable-path allowlist, minimum acceptance condition, and explicit
   non-goals.
5. Preserve unrelated work, old worktrees, branches, stashes, failed attempts, and historical
   evidence.

## Development baseline

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm check
pnpm package:smoke
git diff --check
```

Run additional focused checks for the changed behavior. Record commands that actually ran and
their results in `harness/context/<phase>.md`; expected results are not evidence.

## Change design

- Prefer one small root application and logical modules over packages without independent users.
- Keep functional verdicts independent from Playwright, Git, CLI, and model providers.
- Treat issue text, page text, traces, and model output as untrusted data.
- Execute only trusted commands supplied through explicit configuration.
- Keep replay model-free and retries visible.
- Bound paths, time, attempts, observation size, processes, browser contexts, and evidence growth.
- Do not claim broad platform support, determinism, or reproduction beyond executed evidence.

## Review and handoff

A review states the user-visible outcome, changed paths, non-goals, privacy impact, exact checks,
known limits, rollback, and stop conditions. The phase context records stable contracts and what
successors must not assume. Only an integration owner updates `harness/build-log.md`.

Contributions are licensed under Apache License 2.0 and follow `CODE_OF_CONDUCT.md`. Report
vulnerabilities through the private process in `SECURITY.md`.
