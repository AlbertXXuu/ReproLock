# Preserving business bug detection after test repair

Date: 2026-10-02. Status: measurement controls and one model proposal executed. [简体中文](test-healing-preservation.zh-CN.md).

## Question and prior work

Can a repaired browser test pass on a correct application after a semantics-preserving UI change while still detecting the original business bug in that same changed UI?

[Playwright Test Agents](https://playwright.dev/docs/test-agents) can repair tests or mark them skipped when functionality is broken. The official healer instruction permits assertion changes. This is an allowed capability, not evidence of a frequency of semantic weakening. [SWT-Bench](https://github.com/logic-star-ai/swt-bench) supplies the fail-on-bug and pass-after-fix principle for issue-directed repository test generation. [Healer perturbation v1](https://github.com/voidmatcha/e2e-skills/blob/main/benchmarks/healer-perturbation-v1/README.md) already checks overlapping synthetic cases; this question is not claimed as new.

## Registered controlled case

One synthetic checkout rule is frozen before execution. Two items cost 1000 cents each; Express shipping costs 500 cents; coupon FLAT2 subtracts 200 cents. The committed charge must be 2300 cents. The deliberate application fault ignores the coupon and commits 2500 cents. Old and new UIs preserve the same labels and business rule but use different DOM IDs. The application state is observed independently from the test's own pass or fail report.

The controlled matrix is correct/buggy application × old/new UI × original/repaired/weakened test, with three repetitions. The original test uses old selectors and checks the amount. The repaired control uses accessible labels and keeps the amount assertion. The deliberately weakened control only checks an order acknowledgement. These are authored controls, not model-generated repairs. A skipped output is a separate result, never a repaired pass.

Acceptance: the strong repaired control passes on both correct UIs and fails for the charge error on both buggy UIs; the weakened control produces an observable false green on the buggy new UI; original-selector failures on the new UI are classified as locator failures rather than bug detection. Repetitions test stability for one business case, not independent sample size. A failure of the observer or browser is inconclusive.

## Budget and execution boundaries

Reuse installed Playwright and Chromium, one worker, no retries, loopback only, per-action timeout and per-test timeout. No paid API, dependencies or external accounts. Preserve source hashes, raw local results and a portable summary; close the fixture server and browser after every test. A bounded real-model attempt may use the already signed-in local Codex account and default configured model, with actual metadata recorded. A model proposal without the official healer tool loop is labelled accordingly.

The larger proposed pilot is six independent business cases with three fresh sessions each, comparing official healer with a business-oracle-preserving instruction under matched model, tools and budget. This protocol is not a completed 18-session result.

## Results

The accepted control run completed 36 observations: 15 correct passes, nine business bugs captured, six false greens and six locator failures; twelve skipped controls were separate. The strong authored repair on the new UI passed all three correct-condition repeats and caught all three buggy-condition repeats. The weakened repair passed in both conditions while the independent observer recorded the incorrect 2500-cent charge in all three buggy-condition repeats. These controls establish that this observer detects semantic loss in this fixture.

One actual Codex CLI 0.159.2 invocation returned a proposal using labels and button role, retaining the original amount assertion. It received the old test, current HTML and selector timeout, without the fixture implementation or held-out bug results; it made no tool calls. After review, literal newline escapes were decoded and Biome formatted the proposal. It passed three correct-condition repeats on the new UI and captured the charge bug in three buggy-condition repeats. This is a proposal replay, not the official Playwright healer loop or a matched-harness comparison.

The local configuration requested gpt-6.1-sol with ultra reasoning, but the returned event stream did not expose served-model or actual-reasoning metadata. The saved configuration is not presented as proof of the served settings. The single invocation reported 20,054 input and 427 output tokens, including 221 reasoning tokens; no extra paid service was purchased. [OpenAI's noninteractive documentation](https://developers.openai.com/codex/noninteractive/) documents the structured-output and ephemeral invocation used. Existing Codex account quota was consumed.

The raw Playwright JSON reports retain exact browser observations locally. Portable projections preserve their hashes, runtime browser version, source hashes at projection and each inner candidate outcome. A passed outer test means observation validation, not candidate success. Missing observations, infrastructure errors or unexpected outer failures are inconclusive. [The runnable spike](../../spikes/test-healing-preservation/README.md) links all published evidence.

Two development control runs were excluded: the first exposed ambiguous accessible naming in the fixture (implicit output status and a nested select label); the second exposed ANSI formatting in the error-message check. The fixture and measurement check were corrected before the accepted run. Original raw files and their exclusion records remain in the local audit archive. No unsuccessful model output was discarded or repaired through a second model invocation.

Next gate: add independently defined business rules before any further model runs, then compare identical tools and budgets. This single simple selector change neither proves a new research contribution nor estimates healer failure rates. The planned six-case, eighteen-session comparison is still unexecuted.
