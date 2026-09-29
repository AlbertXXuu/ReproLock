# DrawDB #687 候选测试验证实验

[English（原文）](../../spikes/local-candidate-verification/drawdb-687/REPORT.md) | [简体中文](DRAWDB_687_REPORT.zh-CN.md) | [双语报告索引](../../README.md#evidence-so-far)

> 本文是 [DrawDB #687 REPORT.md](../../spikes/local-candidate-verification/drawdb-687/REPORT.md) 的完整中文译文，对应原报告所记 2026-09-04 的正式实验。原文 SHA-256：`6b9d9032b265f3cf1767edc8a5a8fc33fe9bb3ec1bc5d2ff745d7609f3954824`。原文及冻结证据保持不变；译文保留报告当时的结论与限制，不代表新实验。正文中的 `evidence/` 等相对产物路径以原报告所在的 `spikes/local-candidate-verification/drawdb-687/` 为基准，仓库级命令与路径沿用原文。

## 结果

冻结的独立 Playwright 测试能够区分 Issue #687 对应的两个精确 DrawDB 版本：

| 实验组 | 修复前 `da0f084` | 修复后 `9df18ec` | 进程清理 |
| --- | --- | --- | --- |
| ReproLock 本地验证器 | 20/20 次功能失败 | 20/20 次通过 | 已核实，残留 0 个 |
| 普通 Playwright 对照 | 20/20 次在同一检查点失败 | 20/20 次通过 | 已核实，残留 0 个 |

唯一被接受的修复前差异是 `candidate.spec.ts:54:75` 的原生结果断言：预期 pathname 为 `/`，实际为 `/editor`。重置、空图、建表和保存完成检查都已先行完成。如果缺少 popstate、就绪或 UI 检查，则应判为结果不确定（`inconclusive`），而非功能失败。

结果证实，该验证器能够执行第二个来自真实仓库的本地案例，并保留可复核的差分。它没有显示相对普通 Playwright 的投入优势，后者达到了相同结果。因此产品仍保持 **SPIKE_CONDITIONAL**。

## 来源与冻结

- 上游：<https://github.com/drawdb-io/drawdb>，AGPL-3.0。
- Issue：<https://github.com/drawdb-io/drawdb/issues/687>。
- 修复：<https://github.com/drawdb-io/drawdb/pull/692>。
- 修复前：`da0f084d47cd5cb4992df6d3a23707543338e796`。
- 修复后：`9df18ecc272caf5c2368fc305ae40788103fd0d0`，为前者的直接子提交。
- 冻结候选测试 SHA-256：`2d7fbfcf5701625050aec23491e3beb8746641c27bcd6326446cea73871aa9f2`。
- 正式设置：Playwright 1.62.1、Chromium 无头模式、1280×720、单 worker、零重试，每个版本重复 20 次，测试超时 20 秒，关闭采集。

在候选测试冻结之前，已经阅读了官方 Issue 和 PR 文字，包括其中的代码片段。这是复用的、由 agent 编写的候选测试，不是盲发现实验，也不是独立人工编写实验。在候选测试及比较参数冻结之前，没有查看修复后源码或 diff。

两个版本都使用相同锁文件，通过 `npm ci --ignore-scripts` 安装，再使用仓库的 `npm run build` 构建。由于 `vite preview` 提供的是被忽略的 `dist` 文件，实验为每个版本的全部 28 个文件冻结了一份按路径排序、包含字节数及 SHA-256 的清单。两个实验组执行前后，这些清单、目标指纹、干净状态和版本均保持不变。

## 实际执行

正式 ReproLock 组从 `2026-09-04T18:10:29Z` 运行至 `18:13:18Z`，耗时 169,454 ms，包含应用启动、两套各 20 次的测试，以及外层经过验证的清理。普通 Playwright runner 修复前耗时 66,570 ms，修复后耗时 66,298 ms；包含启动和清理的各组总耗时分别为 71,107 ms 和 70,624 ms。这些数字是 agent 操作下的本地运行时间，不是节省的开发者时间。

之前一次 151,328 ms 的验证器运行也观察到 20/20 + 20/20，但未纳入有效结果：其构建清单在执行开始后才被冻结，而且修复后的清理未得到核实。该次未通过门槛的记录、哈希与原因保留在 `comparison.json` 中，没有被后续成功结果替换。

`evidence/reprolock.json` 是可移植验证器导出。`evidence/comparison.json` 包含完整构建清单，以及普通 Playwright 报告中去除路径后的投影。原始对照报告和进程日志因包含绝对路径而保留在本地；其 SHA-256 值已登记，但 CI 只能检查可移植投影的内部一致性。

## 本地复现

在官方 DrawDB 仓库的两个精确版本上创建干净工作树。每个工作树内运行：

```powershell
npm ci --ignore-scripts
npm run build
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4175 --strictPort
```

当其中一个目标在回环地址上运行时，这份测试仍是普通 Playwright 测试，不导入 ReproLock 运行时：

```powershell
corepack pnpm exec playwright test --config spikes/local-candidate-verification/drawdb-687/playwright.config.ts
```

要执行经过验证的修复前／修复后流程，按[本地验证文档](../local-verification.md)创建本地 JSON 配置，将其指向两个工作树，然后运行：

```powershell
corepack pnpm regression check output/drawdb-687.local.json
corepack pnpm regression run output/drawdb-687.local.json
corepack pnpm regression verify output/verify/<printed-run-id>/export.json
corepack pnpm drawdb:verify:recorded
```

两个目标工作树位于本仓库外，并保留用于复现。它们仅使用合成的浏览器本地数据和回环服务；不使用账户或外部应用。

## 尚待通过的产品门槛

- 尚无独立维护者编写、采用或持续保留这份生成测试。
- 尚未测量人工设置、编写和维护的节省量。
- 普通 Playwright 对照同样稳定，而且在本次本地运行中更快。
- 通用的 Issue 或工作流到生成测试的路径仍未实现。
- 两个案例无法建立广泛项目兼容性或可靠性结论。
