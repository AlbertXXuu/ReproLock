# ADR 0001: Runtime and Toolchain Baseline

- **Status:** Accepted
- **Date:** 2026-09-01
- **Scope:** Repository development, CI, and eventual published package metadata
- **Supersedes:** Nothing

## Context

ReproLock needs one reproducible development path and an explicit lower compatibility bound. The
project uses browser automation, child processes, deterministic evidence serialization, and a
pnpm workspace; allowing each worktree to choose a runtime or package-manager version would make
Spike results and CI failures harder to compare.

This decision is made while ReproLock is an unpublished, pre-Gate candidate. It chooses a
foundation toolchain and does not claim product readiness.

## Verified facts at the decision date

On 2026-09-01, the Node.js official download page identified Node.js `v24.20.0` as the latest LTS
download and also listed `v22.23.2` as LTS. The official releases page classified v24 as Active
LTS and v22 as Maintenance LTS. The release archives provide immutable pages for both exact
versions.

The pnpm project published pnpm `11.19.0`. The selected pnpm version is an exact reproducibility
pin, not a claim that a floating `latest` tag will always resolve to it.

## Decision

| Concern | Decision |
| --- | --- |
| Primary development and CI runtime | Node.js `24.20.0` |
| Repository runtime pin | `.nvmrc` contains `24.20.0` |
| Minimum supported runtime | Node.js `22.23.2` |
| Declared Node.js range | `>=22.23.2 <25` |
| Package manager | pnpm `11.19.0` |
| Package-manager pin | `packageManager: "pnpm@11.19.0"` |
| Node.js type definitions | `@types/node` `22.20.1`, aligned to the minimum runtime line |
| TypeScript mode | Strict |
| Workspace install in CI | Frozen lockfile |

Node.js `24.20.0` is the canonical environment for local development, lockfile changes, package
smoke tests, and primary CI. The minimum runtime `22.23.2` is a compatibility boundary and must be
exercised by compatibility checks before the project makes a support claim for code beyond the
foundation.

The upper bound excludes an unreviewed Node.js major. Moving either bound or the canonical patch
requires a new or superseding ADR backed by official release status, dependency compatibility,
and passing tests on the proposed matrix.

## Repository mapping

The decision is represented in repository files rather than contributor memory:

- `.nvmrc` selects `24.20.0` for compatible version managers;
- `package.json#engines.node` declares `>=22.23.2 <25`;
- `package.json#packageManager` selects `pnpm@11.19.0`;
- the lockfile is committed and CI installs it with `pnpm install --frozen-lockfile`;
- primary CI uses Node.js `24.20.0`; and
- compatibility CI runs the minimum supported Node.js `22.23.2` where support is asserted.

Corepack may activate the package-manager pin, but the checked-in metadata remains authoritative.
No task updates the lockfile with an unpinned pnpm version.

## Rationale

Node.js `24.20.0` gives contributors one current LTS baseline instead of a floating major or the
non-LTS Current line. Retaining `22.23.2` as the minimum creates a deliberate compatibility window
across the two officially listed LTS lines. Exact patch pins make browser, filesystem, process, and
test-runner behavior easier to reproduce across worktrees and evidence runs.

Type definitions track Node.js 22 rather than the canonical Node.js 24 runtime so type checking
cannot silently admit a Node.js 24-only API while the package declares Node.js 22 compatibility.

An exact pnpm version avoids lockfile and workspace behavior changing with a global installation.
The frozen-lockfile rule makes an undeclared dependency-graph change fail visibly in CI.

## Consequences

### Benefits

- New worktrees converge on the same Node.js and pnpm behavior.
- The minimum version is explicit and testable rather than inferred from developer machines.
- A new Node.js major cannot silently enter CI or a product evidence run.
- Toolchain upgrades become reviewed changes with a dated evidence trail.

### Costs and limits

- Maintainers must test both the canonical runtime and the minimum boundary when compatibility is
  relevant.
- Security or correctness fixes may require advancing an exact patch before a scheduled review.
- Contributors using another runtime need to switch versions before results are comparable.
- The pins improve reproducibility but do not prove that the product or its browser matrix works.

## Alternatives considered

### Use a floating `lts/*` runtime

Rejected because two worktrees created on different dates could run different patches and produce
non-comparable lockfiles or evidence.

### Use the newest Current Node.js release

Rejected for the primary path because the official Node.js guidance reserves production use for
LTS lines. Current releases can be evaluated in a separate, non-blocking compatibility job after a
recorded need appears.

### Support only Node.js 24

Rejected at foundation time because the still-LTS Node.js 22 line provides a useful and bounded
minimum for potential users. This support remains an evidence claim: tests must pass at the exact
minimum.

### Leave pnpm unpinned

Rejected because package-manager changes can alter the lockfile, workspace linking, lifecycle
policy, and package output independently of source changes.

## Review and supersession

Review this ADR when any of the following occurs:

- Node.js changes the LTS status or support horizon of a selected line;
- a security release requires a newer exact patch;
- Playwright, pnpm, or another accepted dependency changes its Node.js requirement;
- compatibility tests fail at the declared minimum; or
- the project evaluates support for Node.js 25 or later.

An upgrade PR records the official pages and access date, updates all pins atomically, regenerates
the lockfile with the selected pnpm version, and runs install, formatting, lint, typecheck, tests,
package smoke, and the supported runtime matrix.

## 2026-09-01 v2 scope amendment

The exact Node.js, pnpm, TypeScript, Biome, frozen-lockfile, and runtime-matrix decisions remain
accepted. References in this historical ADR to a multi-package workspace, old parallel Spikes, or
an eventual package topology are superseded by the current local-functional-QA architecture.
ReproLock remains one root application until a real independent consumer or release cycle proves a
physical package boundary. Playwright is admitted only for the executable loopback foundation and
future user-supplied local regression flow.

## Sources

All sources were accessed on **2026-09-01**.

- [Node.js download page](https://nodejs.org/en/download) — identified `v24.20.0` as the latest
  LTS download and listed `v22.23.2` as LTS.
- [Node.js releases and LTS status](https://nodejs.org/en/about/previous-releases) — official
  release-line status and LTS guidance.
- [Node.js v24.20.0 download archive](https://nodejs.org/en/download/archive/v24.20.0) — exact
  primary runtime archive.
- [Node.js v22.23.2 download archive](https://nodejs.org/en/download/archive/v22.23.2) — exact
  minimum runtime archive.
- [pnpm v11.19.0 release](https://github.com/pnpm/pnpm/releases/tag/v11.19.0) — exact
  package-manager release provenance.
