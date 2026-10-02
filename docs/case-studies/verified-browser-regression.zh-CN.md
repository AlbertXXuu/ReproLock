# 对冻结构建验证 DrawDB 浏览器历史回归

2026-10-02 · ReproLock

[English](verified-browser-regression.md) · [网站阅读版](https://alvenx.com/notes/engineering/verified-browser-regression-zh)

一个独立 Playwright 候选测试区分了 DrawDB Issue 687 修复前后的行为。ReproLock 保存了重复差异、构建身份和清理证据；普通 Playwright 对照组则帮助校准了产品价值结论的边界。

## 回放需要区分业务缺陷与环境失败

DrawDB Issue 687 提供了一个具体的浏览器历史回归，可在本地验证。审查后的流程从空图开始，创建并保存一张表，再使用浏览器后退。结果断言要求 pathname 为 /，修复前的版本却停留在 /editor。

如果启动、重置、就绪或清理先失败，单个测试失败就会有歧义。因此 ReproLock 用同一个独立 Playwright 候选测试检查准确的修复前后修订，只将指定业务断言的不满足分类为功能失败。候选测试由 Agent 在阅读官方 Issue 和 PR 提示、包括代码片段后编写；这些来源决定了实验究竟测量了什么。

[DrawDB 官方 Issue](https://github.com/drawdb-io/drawdb/issues/687) · [官方修复 PR](https://github.com/drawdb-io/drawdb/pull/692) · [实验记录与候选测试来源](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/REPORT.md)

## 冻结候选测试与实际服务的应用

对照使用 da0f084d47cd5cb4992df6d3a23707543338e796 及其直接子提交 9df18ecc272caf5c2368fc305ae40788103fd0d0。候选测试和参数在检查修复后源码或 diff 前冻结，但事先阅读了官方提示，因此这是对已准备候选测试的验证，不能据此衡量盲测的 Issue 到测试生成能力。

Vite preview 服务的是 Git 忽略的 dist 文件，单有 Git 身份还不足够。实验因此为每个修订的全部 28 个构建文件，冻结按路径排序的文件名、字节数和 SHA-256 清单。干净 Git 状态、完整修订、目标指纹和构建清单在两个实验臂的执行前后都必须保持一致，让结果绑定到真正被服务的应用。

[构建清单与执行门槛](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/comparison.json)

## 保持候选测试可读与结果检查独立

候选测试使用普通 Playwright，没有 ReproLock 运行时依赖。重置、空图、建表和保存完成检查先执行，随后才运行原生结果断言。唯一被接受的修复前差异出现在 candidate.spec.ts 第 54 行：期望 /，实际 /editor。缺少就绪或导航观察时，结果将被归为 inconclusive。

正式设置为 Playwright 1.62.1、无头 Chromium、1280 × 720 视口、单 worker、零重试、每个修订重复 20 次、每次测试超时 20 秒，并关闭 capture。ReproLock 在这个测试外围补充目标与构建校验、结果分类、执行边界、进程清理和可移植导出。

[独立候选测试](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/candidate.spec.ts) · [可移植验证器导出](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json)

## 两个实验臂复现了相同差异

9 月 4 日被接受的运行记录了修复前 20/20 功能失败、修复后 20/20 通过。普通 Playwright 以相同稳定性观察到同一检查点差异。两个实验臂都验证了进程清理，残留进程为 0。对照共享候选测试与业务设置，但协调器边界并不完全一致，其中包括 ReproLock 的 WebSocket 限制。

更早的一次运行也观察到了 20 次失败与 20 次通过，但构建清单在执行开始后才冻结，修复后的清理也未验证。它继续以被排除的 error 保留。保存这个未通过的门槛，可以避免后来的成功改写实验历史。

| 被接受的实验臂 | 修复前 | 修复后 | 清理 |
| --- | --- | --- | --- |
| ReproLock 本地验证器 | 20/20 功能失败 | 20/20 通过 | 验证完成且残留为 0 |
| 普通 Playwright | 20/20 同检查点失败 | 20/20 通过 | 验证完成且残留为 0 |

[被接受与被排除的执行记录](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/comparison.json)

## 验证成功但产品价值仍待检验

验证器实验臂含启动、两组测试与清理，共用时 169.454 秒；普通 Playwright 修复前后实验臂的总时间分别为 71.107 秒与 70.624 秒。对照在本地同样稳定且更快。这些由 Agent 操作的运行时间不等于开发者投入；配置、编写、维护节省与独立采用尚未测量，产品决定仍为 SPIKE_CONDITIONAL。

可移植证据无需模型调用即可检查。原始对照报告包含绝对路径，因此保留在本地，CI 检查的是投影材料的内部一致性。SWT-Bench 是关于 Issue 复现与用生成测试检查修复的一手研究。这个单一浏览器案例支持已验证的差异与可检查来源，更广项目兼容性和人的实际收益仍需验证。

[运行时间与剩余门槛](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/REPORT.md) · [SWT-Bench 一手论文](https://arxiv.org/abs/2406.12952v3)

## 原始证据

- [DrawDB 实验报告](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/REPORT.md)
- [冻结构建与对照证据](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/comparison.json)
- [独立 Playwright 候选测试](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/candidate.spec.ts)
- [可移植 ReproLock 证据](https://github.com/AlbertXXuu/ReproLock/blob/897392902c5f3eb0663812999dd87b0cf9ade160/spikes/local-candidate-verification/drawdb-687/evidence/reprolock.json)
