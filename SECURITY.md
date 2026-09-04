# Security Policy

ReproLock stores issue/workflow text as inert input, but its reviewed Playwright candidate and both
local target worktrees are trusted executable code. Functional success is invalid if command, path,
privacy, cleanup, or evidence boundaries fail.

## Supported versions

There is no supported public release. The current development line carries no production support
guarantee.

## Report a vulnerability

Use GitHub's [private vulnerability report](https://github.com/AlbertXXuu/ReproLock/security/advisories/new).
Private vulnerability reporting must remain enabled while this repository is public. Do not include
credentials, session data, private repositories, raw sensitive traces, or personal data. Prefer a
synthetic, redacted reproduction. There is no bug-bounty program or guaranteed response window for
this experimental project.

Do not run a candidate copied from an issue, recorder, model, pull request, or other person without
reviewing it as code you are willing to execute under your own user account. The import checks and
browser-origin guard are contract checks, not an operating-system sandbox. Target startup code has
the same trust requirement.

## Current testing boundary

Test only repositories and disposable applications explicitly supplied by the user. Start targets
locally on loopback or in an explicitly disposable local environment. Do not access external
accounts, hosted third-party instances, production systems, or real user data through this
workflow, even if broader authorization might exist elsewhere.

High-priority failures include:

- commands derived from issue, page, trace, or model content;
- absolute-path, traversal, symlink, or output-root escape;
- cookie, token, authorization, storage, environment, screenshot, or trace leakage;
- model self-report or hidden retries being treated as success;
- evidence tampering, non-canonical hashes, or incomplete manifests;
- missing timeout, cancellation, child-process, browser-context, server, or temporary-file cleanup;
- destructive actions outside a fixture explicitly created for the current test.

Security fixes require focused regression coverage and review of derivative artifacts. A redacted
summary is not safe until every included artifact is independently inspected.
