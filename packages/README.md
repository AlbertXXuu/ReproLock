# Packages

This directory is the gated home of future production workspace packages. It intentionally
contains no package in Wave 0: ReproLock is unpublished, has not passed the real-bug product Gate,
and does not yet have an accepted production architecture.

## Package admission

A package may be added only when its task record names:

1. a concrete Issue, reproducible failure, explicit user need, or registered research hypothesis;
2. the repository path containing that evidence;
3. the smallest acceptance condition the package will satisfy;
4. why an existing module or a platform/standard-library capability cannot satisfy it; and
5. the package-local tests and package smoke command that will verify it.

Admission authorizes the smallest useful package, not a family of empty interfaces or future
plugin points. If two proposed packages change together and have no independent consumer or
contract, keep them in one package until evidence establishes a boundary.

## Candidate logical boundaries after the Gate

The architecture baseline names the following responsibilities, but Wave 1 decides whether they
are modules or physical packages:

- contracts/core/evidence/compiler — deterministic schemas, state, oracle verdicts, evidence, and
  plain-test compilation; likely consolidated for v0.1;
- Playwright adapter — browser execution behind core contracts;
- explorer — provider-neutral candidate generation that cannot decide a verdict;
- CLI — the composition root;
- GitHub/Action — distribution that reuses CLI/core behavior; and
- mutation — optional and experimental, admitted only after Spike B evidence.

WebMCP remains a spike and does not enter the MVP package graph.

## Dependency rules

- Core does not depend on Playwright, a model/provider SDK, or GitHub.
- Browser adapters depend inward on deterministic contracts.
- Explorer output is untrusted candidate data; it cannot map itself to `PASS`.
- Replay code does not import a provider SDK.
- The GitHub Action reuses core/CLI logic rather than cloning it.
- Generated tests are ordinary Playwright tests and never import `@reprolock/*` or another private
  ReproLock runtime.
- A package that handles evidence or paths applies redaction, traversal, symlink, and atomic-write
  controls at its boundary.

## Required package shape

Every admitted package must have a clear owner, public entry point, strict TypeScript settings,
tests adjacent to the behavior they verify, and a package smoke path that validates its packed
artifact from a clean temporary consumer. Internal-only modules stay private.

The directory README is a reservation policy, not an npm package and not evidence of product
completion.
