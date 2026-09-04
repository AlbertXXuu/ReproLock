# Contributing to ReproLock

ReproLock accepts focused changes that solve a recorded local functional QA problem or test a
specific hypothesis with inspectable evidence. It is an experimental source project rather than a
supported package or service.

## Before editing

1. Read `PROJECT_CHARTER.md`, `SECURITY.md` and the relevant source or evidence documentation.
   Repository automation and agents must also follow `AGENTS.md`.
2. Search existing issues, then open one before a large change. A real-case trial must use a target
   you are authorized to test and must not upload private source, credentials or raw user data.
3. Run `git status --short --branch`, create one focused branch and preserve unrelated work and
   historical evidence.
4. For a multi-step architecture or evidence change, add an ExecPlan under `plans/`. Small fixes do
   not need ceremonial planning.

## Development baseline

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium
corepack pnpm check
corepack pnpm package:smoke
git diff --check
```

Run focused checks for the changed behavior. Maintainer-led phases record their actual commands and
results in `harness/context/<phase>.md`; expected results are not evidence.

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
