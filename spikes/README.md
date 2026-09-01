# Local functional-regression Spike

The only currently authorized product Spike tests one user-supplied local functional regression.
It is serial, bounded, and does not discover public repositories or bugs.

## Required inputs

```text
TARGET_REPOSITORY_PATH
ISSUE_SNAPSHOT_PATH
PRE_FIX_REVISION
POST_FIX_REVISION
START_COMMAND
RESET_COMMAND
```

The issue must describe ordinary user-visible functional behavior. The target must run locally on
loopback without external accounts, hosted services, production data, payment, email, or
irreversible operations. Commands come only from trusted explicit configuration, never issue/page
or model text.

## Decision sequence

1. Confirm the supplied target, license, prerequisites, immutable revisions, start, readiness,
   reset, and cleanup behavior.
2. Establish the real pre-fix/post-fix functional differential before writing exploration code.
3. Save a versioned issue snapshot and executable independent outcome contract.
4. Run bounded deterministic exploration first; optional model proposals never decide the result.
5. Reset and verify reset before every visible attempt, with zero automatic retries.
6. Minimize actions by replaying each candidate against the same oracle and differential.
7. Generate one readable Playwright test with no ReproLock import.
8. Run 20 independent attempts per revision and compare with a recorder-style baseline.
9. Verify the small evidence bundle, retain any `INCONCLUSIVE` attempt outcomes, and issue a final
   `GO`, `CONDITIONAL GO`, or `NO-GO` according to the predeclared gate.

`GO` alone opens the smallest predeclared production scope. `CONDITIONAL GO` records bounded useful
evidence and the unmet conditions, but it does not open the production gate. `INCONCLUSIVE` is an
attempt/outcome classification when an accepted oracle cannot observe required runtime state; it
is not a guessed pass or failure. `SPIKE_REPORT.md` still ends in `GO`, `CONDITIONAL GO`, or
`NO-GO`.

`CONDITIONAL GO` is available only after every hard gate and the required 20/20 differential pass,
when a named non-core limitation still narrows the claim—for example, human-authored oracle input
or one-platform evidence. The report must name the owner and acceptance condition for removing the
limitation. A missing oracle/reset, unstable differential, runtime/model-dependent replay, or no
visible advantage over the recorder baseline is `NO-GO`, not conditional success.

## Hard gates

- Missing required inputs: do not start the Spike; report the exact missing fields.
- Supplied revisions do not reproduce the declared deterministic differential: `NO-GO`.
- No executable independent outcome contract can be defined and baseline-proven: `NO-GO`.
- Model or ReproLock dependency during ordinary replay: `NO-GO`.
- Unexplained variation or hidden retries: `NO-GO`.
- External account, hosted target, production data, or irreversible operation: out of scope.
- An accepted oracle or reset that cannot observe one attempt returns `INCONCLUSIVE` for that
  attempt; unresolved inconclusive or variable attempts fail the overall gate as `NO-GO`.

Historical public-target, Mutation, and WebMCP spikes remain preserved on old branches only. They
are not current completion evidence and must not be merged wholesale into this line.
