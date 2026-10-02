# Test healing and business bug detection

One controlled checkout case, measured on 2026-10-02. The committed charge is
observed from server state independently of the candidate test's result. The
registered rule requires 2300 cents; the deliberate coupon defect commits 2500.

| Candidate | Correct UI, three repeats | Buggy UI, three repeats |
| --- | --- | --- |
| Strong authored repair, new UI | 3 correct passes | 3 business bugs captured |
| Weakened authored repair, new UI | 3 correct passes | 3 false greens |
| One Codex model proposal, new UI | 3 correct passes | 3 business bugs captured |
| Original old selectors, new UI | 3 locator failures | 3 locator failures |

The full control matrix has 36 executed observations and 12 skipped controls.
The model proposal adds six executed observations. These are repetitions of one
synthetic business case. They do not estimate how often real healers weaken
tests. Outer Playwright passes validate the observations, including expected
inner failures; the summary reads `business-observation` attachments. Missing
observations, browser errors and unexpected measurement failures are inconclusive.

## Reproduce

Use the repository's pinned Node/pnpm/Playwright installation and Chromium.
From the repository root, in PowerShell:

```powershell
New-Item -ItemType Directory -Path output -Force | Out-Null
pnpm exec playwright test --config spikes/test-healing-preservation/playwright.config.ts --grep-invert 'model proposal' --reporter=json | Set-Content output/healing-control.json -Encoding utf8
node spikes/test-healing-preservation/summarize.mjs output/healing-control.json output/healing-control-summary.json
pnpm exec playwright test --config spikes/test-healing-preservation/playwright.config.ts --grep 'model proposal' --reporter=json | Set-Content output/healing-model.json -Encoding utf8
node spikes/test-healing-preservation/summarize.mjs output/healing-model.json output/healing-model-summary.json
```

The generated `output/` directory is ignored. All fixture servers are loopback
only, use ephemeral ports and close in `finally`; Playwright closes each browser
context. Runs use one worker, three repeats, no retries, bounded action and test
timeouts. See [the registered protocol and results](../../docs/research/test-healing-preservation.md)
and [portable evidence](evidence/control-results.json).

The model received only the original test, a selector failure and current UI
HTML. It had no browser tools, application implementation or buggy-condition
results. A single local Codex CLI 0.159.2 invocation returned a reviewed proposal;
literal newline escapes were decoded and Biome formatted it. The official
Playwright healer tool loop was not run. Saved configuration requested
gpt-6.1-sol / ultra; the JSON event stream did not identify the served model or
actual reasoning setting. [Generation metadata](evidence/model-generation.json)
records this distinction, usage, input and output hashes. No new API/service
payment was used; the invocation consumed existing Codex account quota.

## 简体中文

本实验只验证一个合成结账业务。正确金额为 2300 分，故意引入的优惠券错误
实际扣费 2500 分。服务器状态作为独立观察，候选测试自身的通过/失败不决定
业务是否正确。强修复保留金额断言；弱修复只确认下单提示，因此错误应用上
可出现“测试通过、金额仍错”。原选择器无法操作新 UI，计为定位失败；跳过
单独计数。外层测试通过表示观测符合预期，不能写成修复成功率。

控制矩阵完成 36 次执行和 12 次跳过；一次真实 Codex 提案在新 UI 的正确/错误
应用上各重复三次，分别为 3 次通过、3 次抓住业务错误。重复属于同一案例，
不支持评价模型的普遍可靠性。官方 healer 工具循环尚未执行。

[中文协议、结果与限制](../../docs/research/test-healing-preservation.zh-CN.md)
提供判定口径、无效开发运行的排除原因和下一阶段条件。
