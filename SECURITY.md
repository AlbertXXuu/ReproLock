# Security Policy

ReproLock handles hostile issue text, repositories, web pages, traces, generated data, and browser
state. Security and privacy failures can invalidate its evidence even when functional tests pass.

## Supported versions

ReproLock has no supported public release yet. During the pre-release phase, security fixes are
made only on the current development line. No historical build or unpublished artifact carries a
support guarantee.

## Report a vulnerability

Do not open a public issue or include exploit details in a public discussion. Use the repository
host's private security-advisory channel. If that channel is unavailable, contact the maintainers
through an official private AlvenX channel and share only enough information to establish a secure
follow-up path.

Include, when safe:

- affected commit, version, and operating environment;
- a minimal reproduction and expected impact;
- whether secrets or third-party data may have been exposed;
- suggested mitigation, if known.

Do not send live credentials, session data, private repositories, raw HAR files, or personal data.
Use synthetic or redacted fixtures. Maintainers should acknowledge a report privately, reproduce it
in an isolated environment, agree on disclosure timing, and credit the reporter if requested.

## In-scope risk areas

High-priority reports include:

- command or generated-code execution from issue, page, trace, or model content;
- path traversal, symlink escape, or writes outside an approved root;
- token, cookie, authorization header, storage, trace, screenshot, or environment leakage;
- privilege escalation in CI, especially unsafe fork or `pull_request_target` behavior;
- false confirmed reproductions caused by agent self-report, hidden retries, or evidence tampering;
- evidence hash or manifest integrity failures;
- missing timeout, cancellation, child-process, or browser-context cleanup;
- destructive browser actions outside an explicit disposable-environment policy.

## Safe research expectations

Test only systems and accounts you own or are authorized to use. Prefer local disposable fixtures,
minimize access and retention, stop when real user data could be affected, and do not perform
destructive actions or persistence. Security testing does not authorize access to third-party
systems or bypass applicable law.

Security fixes require focused regression coverage, an evidence-backed impact assessment, and a
review for adjacent data exposure. Never publish a sanitized-looking bundle before verifying that
all derivative artifacts are also redacted.
