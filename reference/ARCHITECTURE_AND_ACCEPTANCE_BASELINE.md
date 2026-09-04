# ReproLock Architecture and Acceptance Baseline

- **Status:** Phase baseline for human review
- **Decision:** `CONDITIONAL GO` for architecture/foundation; product `GO` remains gated
- **Scope:** Local functional QA on explicit user-supplied repositories and disposable targets

## Product definition

The primary user is a web-application maintainer with a reproducible functional regression, a
local development setup, known pre-fix and post-fix commits, and a need for a durable test without
a model dependency in replay or CI.

The job is: turn the maintainer's issue or workflow into a reviewable outcome contract, a minimized
action sequence, one standalone Playwright test, and repeatable evidence that the test fails before
the fix and passes after it.

ReproLock is not a public-target discovery service, generic autonomous QA agent, hosted browser
farm, dashboard, benchmark, vulnerability scanner, universal agent ABI, or replacement for
Playwright. Git hosting integration, external accounts, hosted targets, Mutation, WebMCP, and model
providers are outside the current vertical slice.

## Exact trusted inputs

The first real Spike requires:

- a local target repository path supplied by the user;
- an immutable local issue/workflow snapshot supplied by the user;
- full pre-fix and post-fix commit IDs;
- trusted start command represented as executable plus argument array, working directory, bounded
  environment allowlist, loopback URL, readiness check, and timeout;
- trusted reset command or explicit reset strategy plus a deterministic reset postcondition;
- an executable outcome contract;
- action, time, observation, attempt, process, artifact, and optional provider-cost limits; and
- an explicit output root.

Commands never come from issue text, page text, repository prose, traces, generated notes, or model
output. The default workflow does not write into the user's target checkout.

The experimental source-alpha `init` command only copies bounded UTF-8 input as inert, ignored data
and emits an intentionally incomplete test scaffold. It does not interpret that input. The local
candidate and both target worktrees become trusted executable code only after human review. Ignored
runtime trees declared in `servedPaths` are included in the target fingerprint; the run output root
resolves beside the local case configuration and may not overlap a target.

## Outputs

- normalized versioned issue snapshot;
- outcome contract and its executable oracle definition;
- visible attempt records and minimization decisions;
- one readable standalone Playwright spec and metadata;
- pre/post differential and repeated-replay summaries;
- data-handling report and canonical hash manifest; and
- an evidence-backed report with attempt-level outcomes and a final `GO`, `CONDITIONAL GO`, or
  `NO-GO` decision.

All portable artifacts use relative `/`-separated paths. Private values and unrelated local paths
are excluded.

## First-use workflow and first value

1. Validate the explicit configuration and scope.
2. Create disposable worktrees at both revisions.
3. Install only from the target's trusted lockfile/configuration.
4. Start, ready-check, reset, and independently confirm the supplied differential.
5. Normalize the issue snapshot and author/review the outcome contract.
6. Explore deterministically, then minimize while preserving the oracle and differential.
7. Compile and verify one standalone test on both revisions.
8. Repeat 20 independent attempts per revision and verify the evidence manifest.

The ten-minute first-value clock begins only after configuration validation and a successful local
target readiness check. First value is the first independently checked `pass` or `fail`, or an
actionable `inconclusive` naming the missing observability/reset condition. Setup error or
cancellation does not count as first value.

## Smallest architecture

ReproLock remains one TypeScript application with logical boundaries:

- **domain:** outcome, attempt, reset, limits, and minimization decisions;
- **runtime:** local process lifecycle, worktree/revision isolation, readiness, reset, cancellation,
  and cleanup;
- **browser:** Playwright actions and structured observations;
- **oracles:** DOM, URL, storage, and composed business checkpoints;
- **evidence:** schemas, canonical JSON, atomic writes, hashes, manifest, redaction, and verifier;
- **compiler:** selector policy, metadata, and standalone Playwright source;
- **CLI:** trusted configuration and composition root; and
- **explorer:** optional future candidate producer behind a narrow port, with no verdict authority.

Domain and evidence do not import Playwright, Git hosting, or provider SDK types. Adapters depend
inward. Do not materialize an unused module or package merely because the boundary is named.

## Outcome and terminal-result contracts

Functional outcome and operational termination are separate.

```ts
type OutcomeVerdict =
  | { kind: "pass"; evidence: EvidenceRef[] }
  | {
      kind: "fail";
      firstFailedCheckpoint: { id: string; expected: JsonValue; observed: JsonValue };
      evidence: EvidenceRef[];
    }
  | {
      kind: "inconclusive";
      reasonCode: "oracle_unobservable" | "reset_unverified" | "state_ambiguous" | "timeout";
      message: string;
      evidence: EvidenceRef[];
    };

type AttemptResult =
  | {
      schemaVersion: 1;
      attemptId: string;
      status: "completed";
      stage: "outcome_checked" | "persisted";
      verdict: OutcomeVerdict;
    }
  | {
      schemaVersion: 1;
      attemptId: string;
      status: "error";
      stage: AttemptStage;
      code: string;
      message: string;
      evidence: EvidenceRef[];
    }
  | {
      schemaVersion: 1;
      attemptId: string;
      status: "cancelled";
      stage: AttemptStage;
      reason: "user" | "deadline";
      evidence: EvidenceRef[];
    }
  | {
      schemaVersion: 1;
      attemptId: string;
      status: "policy_denied";
      stage: AttemptStage;
      code: string;
      message: string;
      evidence: EvidenceRef[];
    };
```

Every persisted terminal record carries a stable stage. A functional `fail` identifies the first
business checkpoint that differs; it does not assert root cause. An unobservable state never
becomes `pass` or `fail`.

## Lifecycle, reset, timeout, cancellation, and cleanup

```text
planned
  -> target_started
  -> reset_completed
  -> actions_running
  -> outcome_checked
  -> finalizing
  -> persisted
```

Any active stage may transition to `finalizing` because of operational error, policy denial,
deadline, or user cancellation. An `AbortSignal` crosses CLI, supervisor, browser, oracle, and
writer boundaries. Finalization stops new work, closes browser contexts, terminates only owned
processes within a bound, removes temporary files, and persists the terminal record when possible.
Repeated cancellation is idempotent. Cleanup failure is recorded and makes the command an
operational error rather than hiding it behind the earlier outcome.

There are zero automatic retries. Twenty confirmations are twenty visible independent attempts.
Every attempt runs and verifies reset first. A start/readiness failure is `error`; an unobservable
reset or oracle timeout is `inconclusive`; an overall user deadline is `cancelled`. Timing delays
are not semantic actions unless the business outcome itself is time-based.

Windows and Linux process-tree cleanup remain an evidence claim: support is stated only for
platforms where the relevant fixture tests actually pass.

## Outcome contract and oracle rules

An outcome contract names observable business checkpoints separately from actions. At least one
final-state checkpoint is required. Intermediate checkpoints are ordered only when they carry
business meaning. DOM role/name/state, URL, storage, or composed checks may be used; screenshots
are supporting evidence, not the primary verdict.

The same oracle must distinguish the two supplied revisions before exploration results count. An
oracle conflict, missing state, or ambiguous observation is `inconclusive`. Model statements and
recorder completion are never oracles.

## Minimization

Start with a confirmed action sequence. Remove one candidate action at a time, reset and verify the
precondition, replay with the unchanged outcome contract on both revisions, and retain the removal
only when the same differential remains stable. Never remove an oracle, reset, business
precondition, or required confirmation. Preserve the original/final action counts and every
decision. Incidental waits are replaced by observable readiness, not retained as unexplained
semantic steps.

## Standalone Playwright compiler

Generated source:

- imports only `@playwright/test` and explicitly allowed target-owned helpers;
- contains readable arrange/act/assert sections and a final business-state assertion;
- uses semantic locators before test IDs, labels, or bounded CSS fallbacks;
- safely encodes all external text as data;
- does not import ReproLock, a model provider, or evidence runtime;
- records external start/reset prerequisites in metadata; and
- is formatted, typechecked, and executed unchanged on both revisions.

## Evidence contract

Canonical JSON is UTF-8 with one trailing LF, recursively UTF-16-code-unit-sorted object keys,
semantic array order, and rejection of `undefined`, non-finite numbers, cycles, accessors, hidden
properties, and non-plain objects. Durable files have schema versions and SHA-256 hashes. Paths are
output-root-relative, use `/`, and reject backslashes, drive/ADS colons, traversal, control
characters, trailing dots/spaces, and Windows device names before host-path conversion. Resolved
parents remain inside the root. The output root must be outside the target checkout and
coordinator-owned. The current writer does not claim to defeat a target that deliberately races
filesystem entries inside that root because portable Node filesystem APIs cannot close that race.

Writes use a same-directory unique temporary file, flush and close it, publish it through a
no-overwrite hard link, and remove the temporary name. This gives atomic visibility and immutable
file names on the executed local filesystem; it is not a claim of power-loss durability or support
for filesystems without local hard links. The manifest is written last. A verifier rejects missing
files, hash mismatch, path escape, unsupported schema, and unexpected sensitive or machine-specific
data.

The first vertical slice uses immutable per-attempt JSON files plus a final canonical summary,
rather than relying on ambiguous append atomicity for `attempts.jsonl`.

## Minimal CLI contract

The first vertical slice needs only configuration validation, run/compare, replay, and evidence
verification. Capture, exploration convenience commands, hosted integration, and a large command
surface wait for a current caller.

| Command status | Exit | Meaning |
| --- | --- | --- |
| `satisfied` | 0 | requested predicate satisfied, or an informational command completed successfully |
| `not_satisfied` | 1 | execution completed deterministically but the requested predicate was not satisfied |
| `invalid` | 2 | invalid invocation, configuration, or schema |
| `inconclusive` | 3 | required outcome was inconclusive |
| `error` | 4 | setup, runtime, cleanup, evidence, or internal error |
| `policy_denied` | 5 | policy denied the requested operation |
| `cancelled` | 6 | graceful user/deadline cancellation |

Each CLI returns a versioned `CommandResult` envelope whose `status` maps to exactly the exit code
above. `AttemptResult` remains a separate evidence contract: the command maps a completed attempt's
verdict to `satisfied`, `not_satisfied`, or `inconclusive` according to its explicit predicate;
pre-attempt validation failure maps to `invalid`. `--json` does not change exit codes. Terminal
stdout contains one `CommandResult`; diagnostics use stderr.
`compare-revisions` defaults to the explicit predicate pre-fix FAIL / post-fix PASS: match is 0,
another completed combination is 1, inconclusive is 3, and operational error is 4.

## Foundation acceptance

- strict TypeScript, formatter, linter, unit tests, and package archive smoke pass;
- terminal-result serialization has an exact-byte golden test;
- bounded atomic evidence writing verifies final bytes, traversal rejection, and failed-write
  cleanup;
- Chromium confirms one user-visible final state against an ephemeral loopback fixture with one
  worker and zero retries;
- CI installs the pinned Chromium and runs the same checks without secrets;
- current docs contain no active public-target, Mutation, WebMCP, dashboard, provider, or premature
  package route; and
- fixture evidence is labelled as foundation evidence, not product readiness.

## Future Spike acceptance

- exact supplied pre/post commits and one unchanged generated spec;
- deterministic independent baseline and outcome oracle;
- verified reset before every attempt and zero hidden retries;
- pre-fix 20/20 expected FAIL and post-fix 20/20 expected PASS;
- replay makes zero model calls and generated source has no ReproLock import;
- minimization and recorder comparison show material benefit in outcome explicitness, steps,
  stability, checkpoint localization, auditability, or human editing;
- evidence verification passes with no secret or absolute machine path; and
- timeout/cancellation leaves no owned browser, listener, process, or temporary artifact.

## Kill and adjustment criteria

Stop the case when success depends on model self-report or screenshot similarity, reset cannot be
verified, issue/page/model text must drive shell or arbitrary JavaScript, the target requires an
external account or hosted/production system, generated replay depends on ReproLock, evidence
cannot be bounded/redacted/verified, cancellation leaves owned resources, or stability requires
hidden retries or unexplained waits.

The real Spike is `NO-GO` when no independent executable oracle/reset can be defined and
baseline-proven, the unchanged spec cannot obtain the required 20/20 differential, or the
predeclared recorder comparison shows no material advantage. An accepted oracle that cannot
observe one runtime attempt returns an `inconclusive` attempt verdict; unresolved inconclusive or
variable attempts make the overall Spike `NO-GO` and never authorize broader implementation.
`CONDITIONAL GO` is allowed only after all hard gates pass, when a named non-core limitation such as
human-authored oracle input or one-platform evidence narrows the claim; it names an owner and
acceptance condition and does not open production implementation.

## Current decision and open assumptions

Foundation and architecture remain `CONDITIONAL GO`. As of 2026-09-04 the supplied Safe Unfollow
#163 case has repeated 20/20 pre-fix failure and post-fix success, including a separate recovery
revalidation and Windows cancellation/cleanup checks. The honest manual baseline reaches the same
differential, so the case remains `SPIKE_CONDITIONAL` and product GO is not granted. A less-structured
user-supplied case and explicit effort/maintenance-value decision are required before broader
implementation. See the phase 02 context for the exact local runtime matrix and source PR/CI
status. Other-platform process-tree behavior is not established by the Windows result.
