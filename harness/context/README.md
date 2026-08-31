# Phase Context Records

Each task branch owns exactly one durable context file:

```text
harness/context/<phase>.md
```

Use a stable lowercase kebab-case phase identifier. Parallel branches must not edit another phase's
context or the central build log. Context records are evidence summaries, not substitutes for test
artifacts or immutable source data.

## Required contents

```markdown
# <Phase name>

## Scope
- Branch and base commit:
- Authorized paths:
- Goal and minimum acceptance conditions:
- Non-goals:

## Context read
- Instruction, charter, ADR, plan, and evidence files consulted.

## Baseline
| Command | Exit/result | Observable evidence |
| --- | --- | --- |

## Decisions
| Time (UTC) | Decision | Evidence and reason | Rejected alternative |
| --- | --- | --- | --- |

## Changes
- Repository-relative path and purpose for each changed file.

## Verification
| Command | Exit/result | Observable evidence |
| --- | --- | --- |

## Risks and unresolved items
- Known limitation, owner, required evidence, and stop/adjust condition.

## Stable handoff
- Contracts, commands, and evidence later phases may rely on.
- Items later phases must not assume.
```

## Evidence rules

- Record commands exactly as run and summarize actual output and exit status.
- Use UTC timestamps and repository-relative paths. Do not record local home paths.
- Link durable artifacts; include hashes for evidence whose integrity matters.
- Preserve failed attempts, retries, and inconclusive outcomes.
- Redact tokens, cookies, authorization headers, session identifiers, credentials, personal data,
  and sensitive page or trace content.
- Distinguish fact, inference, decision, and unknown. Never use “should pass” as a result.
- Update the matching ExecPlan when evidence changes the design or gate.
