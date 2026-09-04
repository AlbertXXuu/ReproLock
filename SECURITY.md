# Security Policy

ReproLock handles untrusted issue text, repositories, page content, traces, generated data, and
browser state. Functional success is invalid if command, path, privacy, cleanup, or evidence
boundaries fail.

## Supported versions

There is no supported public release. The current development line carries no production support
guarantee.

## Report a vulnerability

Use the repository host's private security-advisory channel or an official private AlvenX contact.
Do not include credentials, session data, private repositories, raw sensitive traces, or personal
data. Prefer a synthetic, redacted reproduction.

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
