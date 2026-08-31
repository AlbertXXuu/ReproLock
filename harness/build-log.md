# ReproLock Build Log

This is the central integration record for evidence-gated phases. Wave 0 creates this file; after
that initialization, only the integration branch may update it. Task branches write their actual
commands and evidence to `harness/context/<phase>.md`.

## Verdict vocabulary

- `GO`: every required gate passed with inspectable evidence.
- `CONDITIONAL GO`: explicitly permitted follow-up remains; the unmet condition and owner are named.
- `NO-GO`: a required gate failed; dependent implementation must not start.
- `INCONCLUSIVE`: the result cannot be established because environment, reset, or observability is
  insufficient.

Do not translate errors into product failures, treat missing evidence as success, or record a gate
from an agent's assertion alone.

## Integrated phases

| Wave | Phase | Source branch/commit | Verdict | Evidence | Remaining condition |
| --- | --- | --- | --- | --- | --- |
| 0 | Repository foundation | Pending integration | Pending | `harness/context/00-repository-foundation.md` | Run and record the complete foundation verification matrix. |

An integration entry is complete only when it names an immutable commit, links repository-relative
evidence, records actual verification results, and states every residual risk or condition.
