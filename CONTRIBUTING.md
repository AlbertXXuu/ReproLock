# Contributing to ReproLock

ReproLock is an evidence-gated AlvenX pre-product project. Contributions should make one
current, demonstrated problem easier to verify, reproduce, or maintain.

## Before editing

1. Read `AGENTS.md`, `PROJECT_CHARTER.md`, accepted ADRs, and the applicable phase context.
2. Run `git status --short --branch` and inspect existing files and changes.
3. Use a dedicated branch and exclusive worktree for the task.
4. Confirm the authorized file scope and the issue, failure, user need, or research hypothesis
   that justifies the change.
5. Create an ExecPlan when `PLANS.md` requires one.

Do not implement adjacent features, rewrite unrelated work, or lower a product gate to make a
change appear complete. Parallel task branches write only their own
`harness/context/<phase>.md`; after its Wave 0 initialization, the central
`harness/build-log.md` belongs to the integration branch.

## Development baseline

Use the runtime versions recorded in `.nvmrc`, `package.json`, and
`docs/adr/0001-runtime-and-toolchain.md`. Install with the repository's pinned pnpm version.

The standard read-only validation path is:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm package:smoke
git diff --check
```

Use `pnpm format` only when formatting changes are intended; `pnpm format:check` is the
non-mutating check. Run additional focused, integration, browser, security, and differential
tests required by the affected behavior. Record exact commands and actual outcomes in the phase
context; “should pass” is not evidence.

## Change design

- Prefer the smallest complete vertical slice and repository-native capabilities.
- Keep core verdict and evidence logic independent of browsers, GitHub, and model providers.
- Treat issue text, pages, repositories, traces, and model output as untrusted.
- Preserve deterministic output, explicit failure semantics, cancellation, cleanup, and privacy.
- Do not add a package, abstraction, dependency, or public surface without a current acceptance
  test that demonstrates its need.

## Review and submission

Keep each change coherent and reviewable. A review description includes:

- the observed problem and minimum acceptance condition;
- changed paths and deliberate non-goals;
- security and privacy impact;
- commands run and evidence produced;
- known limits, rollback, and unresolved risks.

Reviewers apply the invariant and security checklist in `AGENTS.md`. A reproduction claim requires
independent oracle evidence; agent output, screenshots, and implementation existence are not enough.

By contributing, you agree that your contribution is licensed under Apache License 2.0 and that
you will follow `CODE_OF_CONDUCT.md`. Report vulnerabilities through the private process in
`SECURITY.md`, not a public issue.
