# Safe Unfollow #163 本地功能回归 Spike A

[English（原文）](../../spikes/local-functional-regression/SPIKE_REPORT.md) | [简体中文](SPIKE_REPORT.zh-CN.md) | [双语报告索引](../../README.md#evidence-so-far)

> 本文是 [SPIKE_REPORT.md](../../spikes/local-functional-regression/SPIKE_REPORT.md) 的完整中文译文，涵盖 2026-09-01 实验及 2026-09-04 恢复复核。原文 SHA-256：`9f5480fc34074cb8b53123422b9c242651998a85ca3a52604a679d37bde5640a`。原文及冻结证据保持不变；译文保留报告当时的结论、限制与待办，不代表新实验。正文中未带链接的相对产物路径以原报告所在的 `spikes/local-functional-regression/` 为基准，仓库级命令与路径沿用原文。

## 决策

**`SPIKE_CONDITIONAL`**

功能性硬门槛已通过：一份冻结的独立 Playwright 测试在指定修复前版本上，因预期的用户可见原因失败；同一份测试字节不变，在指定修复后版本上通过。每个版本各进行 20 次独立尝试，重复得到该差分结果，重放期间零重试、零模型调用。

结论仍有条件，因为这条 Issue 异常详细，确定性的存储状态注入显著降低了探索难度，而且诚实的录制式／人工基线同样实现了两个操作的差分，以及 20/20 的稳定性。ReproLock 增加了显式结果契约、经过验证的重置、无障碍定位器、稳定的检查点失败标识、冻结假设证据及可校验清单，但本例的增量收益有限。

**尚未获得产品 `GO`。** 这只是一个外部校准案例，不能作为广泛产品主张、生产实现、v0.x 或 v1.0 的证据。

## 目标与来源

| 字段 | 已核实的值 |
| --- | --- |
| 仓库 | `https://github.com/ignromanov/safe-unfollow.git` |
| 许可证 | MIT |
| 包管理器 | npm |
| 锁文件 | `package-lock.json`，锁文件版本 3 |
| 修复前 | `64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47` |
| 修复后 | `ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa` |
| 提交关系 | 修复后提交的直接父提交即修复前提交 |
| 运行时 | Node.js 22.23.2，npm 10.9.8 |
| 浏览器 | Playwright 1.62.1，Chromium 151.0.7922.34 |

两个版本的工作树始终处于 detached 状态且保持干净，使用完全相同的已提交锁文件，其 SHA-256 为 `5bae88ae4fbc179f7eb6486b49dcaa4eb35a32abb134a6bc006cb7150689f955`。目标未声明 Node 引擎版本范围。`npm ci` 在每个版本安装了 900 个包，并报告相同的 22 项依赖审计发现；依赖修复与安全评估不属于本次功能 Spike 的范围。

## 盲测协议与冻结假设

仅使用修复前源码和运行行为来发现存储夹具、UI 定位器、重置方法与结果契约。在创建修复后工作树或阅读其源码之前，候选测试及支撑假设文件已经格式化、计算哈希，并独立复算哈希。

- 冻结时间：`2026-09-01T10:47:50.405Z`。
- 独立测试 SHA-256：`d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad`。
- 冻结的修复前特征：在 `processing-cleared` 检查点出现功能失败，因为 `Analyzing locally...` 仍然可见。
- 首次修复后执行：冻结字节不变，测试通过。
- 仅在得到首次修复后结果后才检查修复差异。

完整冻结文件清单及哈希见 `frozen-hypothesis.json`。

## 复现流程与独立结果契约

每次尝试使用新的浏览器上下文，并执行以下显式重置：

1. 核实 `http://127.0.0.1:4173/upload` 已就绪；
2. 创建全新的 Chromium 上下文，阻止非回环地址请求；
3. 清除 cookies；
4. 打开不含脚本的同源 `/robots.txt` 资源；
5. 清除并核实 localStorage、sessionStorage、IndexedDB、Cache Storage 及 service workers；
6. 仅向 `unfollow-radar-store` 注入 schema 版本 5 的合成 `uploadStatus: "loading"` 状态；
7. 导航至 `/upload`，等待网络空闲、上传标题及两个动画帧；
8. 按顺序执行结果检查点，在 `finally` 中关闭上下文。

使用 `/robots.txt` 重置，避免了已被证实的竞态：正在运行的应用会在存储清空后立即重新写入数据。状态夹具是受控前置条件；改写存储本身不是判定结果的依据。

具有最终判定权的契约检查状态恢复后的用户界面：

1. `/upload` 及其标题可以被观察到；
2. `Analyzing locally...` 隐藏；
3. 处理状态播报不存在；
4. 标签为 `Upload Instagram data ZIP file` 的文件输入控件可用；
5. 空闲上传提示可见。

文件输入控件的可用状态是最直接、最强的可操作性检查。其他功能检查是同一个 `isProcessing` 分支的语义佐证，不是四项独立的因果证明。截图或模型陈述都不决定最终判定。

## 差分与重复

| 测试 | 修复前 | 修复后 | 重试次数 | 模型调用次数 |
| --- | ---: | ---: | ---: | ---: |
| 冻结独立测试，首次执行 | 1 次预期功能失败 | 1 次通过 | 0 | 0 |
| 冻结独立测试，门槛验证 | 20/20 次预期功能失败 | 20/20 次通过 | 0 | 0 |
| 录制式基线，门槛验证 | 20/20 次预期失败 | 20/20 次通过 | 0 | 0 |

冻结测试的全部 20 次修复前尝试都首先在 `processing-cleared` 失败；没有任何一次在启动、重置、浏览器执行或可观测性阶段失败。全部 20 次修复后尝试都通过了所有检查点。两侧使用相同的测试文件哈希、Chromium 版本、视口、服务启动命令、重置与结果契约。

原始 Playwright 报告包含本地路径和堆栈位置，因此保留在被忽略的本地输出中。`attempts.jsonl` 保存了 40 条标准化门槛尝试记录，去除了这些私有细节。

## 最小化

候选流程起初包含两个浏览器导航操作：

1. 导航到不含脚本的同源资源以执行重置；
2. 注入中断状态后，导航到 `/upload`。

第一个操作是显式重置所必需的。删除第二个操作后，分别在两个版本上使用全新上下文重放：两者都停留在 `/robots.txt`，上传页不可观测，结果为 `inconclusive`。因此该操作仍然必要。最终操作数：**2 个，原有 2 个**。

## 录制式对照

| 维度 | 冻结语义测试 | 直接实现的基线 |
| --- | --- | --- |
| 导航操作数 | 2 | 2 |
| 前置条件清晰度 | 显式重置后置条件，加上带版本的夹具 | 清空并注入同一夹具，但没有显式重置断言 |
| 选择器 | 无障碍标题、标签、状态及可见文本 | 标签／CSS ID 加文本 |
| 业务结果清晰度 | 外置的有序契约，带稳定检查点 ID | 等效的用户可见断言，但只内联在测试中 |
| 多余步骤 | 两次导航都不能删除：一次建立经过验证的重置，一次打开应用 | 同样的两次必要导航，没有人为添加录制噪声 |
| 失败信息质量 | `functional-checkpoint:processing-cleared` 标识第一个失败结果 | 通用定位器断言报告加载指示器仍然可见 |
| 差分 | 修复前 20/20 失败；修复后 20/20 通过 | 修复前 20/20 失败；修复后 20/20 通过 |
| 维护假设 | 存储键／schema 版本和英文无障碍 UI 保持稳定 | 相同的存储及英文 UI 假设，额外要求 DOM 标签／ID 保持稳定 |

没有刻意构造弱基线：基线使用相同夹具、两个操作、浏览器、视口、重置意图及四项面向用户的结果。ReproLock 的优势体现在证据结构和诊断，而非流程更短或更稳定。有限的增量优势是一项产品风险。

## 盲测结果之后的根因解释

修复前的 store 持久化了 `uploadStatus: "loading"`，但内存中的 worker、文件、promise 和 abort controller 无法跨刷新保留。状态恢复过程将 store 标记为已恢复，却保留了这个不可能继续完成的瞬态状态，导致没有剩余控制流可以将其恢复为空闲。因此上传 UI 持续显示加载指示器，并禁用文件输入控件。

修复后提交仅将从持久化数据恢复出来的 `loading` 状态归一为 `idle`。该提交还增加了手动取消路径，但冻结测试从未使用该控件；通过结果来自状态恢复行为。结果判定逻辑并非从修复内容反向设计。

## 命令与实际结果

本次 Spike 中实际执行的主要命令包括：

```text
git rev-parse --show-toplevel
git status --short --branch
git rev-parse HEAD
git worktree list --porcelain
git stash list
git switch -c spike/local-functional-regression
git clone --no-checkout https://github.com/ignromanov/safe-unfollow.git <target-control>
git worktree add --detach <pre-fix-worktree> 64c8a1d0f4c1a9a4ffbab2ea319d89bcab21ad47
git worktree add --detach <post-fix-worktree> ab55329e354dfb121486d7ff1f7daa2fa2e2e5fa
npm ci
npm run dev -- --host 127.0.0.1 --port 4173 --strictPort
pnpm exec tsc --project spikes/local-functional-regression/generated/tsconfig.json --noEmit
pnpm exec playwright test --config spikes/local-functional-regression/generated/playwright.config.ts
pnpm exec playwright test --config spikes/local-functional-regression/generated/playwright.config.ts --repeat-each=20 --reporter=json
pnpm exec playwright test --config spikes/local-functional-regression/baseline/playwright.config.ts --repeat-each=20 --reporter=json
node spikes/local-functional-regression/generated/replay-safe-unfollow-163.mjs --repeat 1
node spikes/local-functional-regression/tools/evidence-cli.ts materialize --bundle-root spikes/local-functional-regression <four-local-raw-reports>
node spikes/local-functional-regression/tools/evidence-cli.ts manifest --bundle-root spikes/local-functional-regression
node spikes/local-functional-regression/tools/evidence-cli.ts verify --bundle-root spikes/local-functional-regression
pnpm check
pnpm package:smoke
git diff --check
```

未运行目标的 3000+ 项完整测试套件；本次有界浏览器差分不需要该套件。

## Spike 期间公开记录的修正

- PowerShell 中未加引号的 `^{commit}` 表达式被错误解析；随后使用严格加引号的版本标识重新验证了两个对象。
- PowerShell 的 JSON 转换器拒绝锁文件中的空属性名；在不修改文件的情况下读取了锁文件版本。
- 候选首次运行返回 `reset-error`，原因是运行中的上传应用重新写入了存储；在假设冻结前，将重置移至不含脚本的同源资源。
- 录制式基线首次运行在浏览器执行上下文内引用了 Node 常量；改为显式传入夹具后，重新运行并进行了类型检查。

没有隐藏失败尝试，也没有将失败改判为成功，且没有引入自动重试。

## 证据校验

只有在证据 CLI 将四份原始报告绑定到预期配置、测试文件名、精确测试标题、单 worker、重复次数 20、零重试及预期的修复前可见／隐藏失败语义后，才接受这些报告。物化处理生成了恰好 40 条规范化尝试：先是 20 条修复前、位于 `processing-cleared` 的 `functional-failure` 记录，然后是 20 条修复后 `pass` 记录。每条记录都包含冻结测试哈希和 `modelCalls: 0`。

所有证据包文件定稿后，重新生成了包含 26 个条目的 SHA-256 清单。最终校验器退出码为 0，输出 `{"command":"verify","issues":[],"ok":true,"schemaVersion":1}`。它独立检查必需文件、清单精确字节、所有冻结哈希、20 + 20 重复门槛、物化摘要与尝试／冻结元数据／源码的一致性、带 schema 版本的规范化 JSON，以及已提交内容不含机器本地路径。原始 reporter 文件仍被忽略，通过哈希及可移植运行元数据表示。

`pnpm check` 同样以 0 退出：格式、lint、根目录严格类型检查、全部 23 项单元测试及 1/1 项回环浏览器测试均通过。两个独立测试 TypeScript 项目均通过类型检查；包冒烟检查通过，大小为 86,371 字节。修复后重放包装器增加回环保护后通过 1/1；同时，`TARGET_BASE_URL=https://example.com` 按要求在就绪探测访问之前以 1 退出。

## 限制与解除条件

- Issue 提供了关键的中断状态概念，并暗示了可能的 `loading` 字段；探索主要是在核实准确的键／schema 和 UI 语义。
- 存储状态注入具有确定性，但与实现耦合。仅通过 UI 中断真实解析器的方法耦合较少，但更慢、变化也更多。
- 基线在操作数和稳定性上与生成测试相同，因此产品差异化的证据有限。
- 证据仅覆盖 Windows、一个 Chromium 构建、一个目标，以及一条异常详细的 Issue。
- 新建的控制克隆使用 `--no-checkout`；其索引报告默认分支删除状态。实际测试的两个版本工作树干净且具有判定效力，但不能将控制克隆本身描述为干净。
- 目标依赖的审计发现已记录，但未调查，因为本任务不是安全任务。

解除有条件状态的责任方：ReproLock 下一外部验证阶段。验收条件：第二个用户提供、结构较少的功能案例必须需要实际发现结果与工作流，保留无模型依赖的稳定差分，并相对诚实的人工基线体现更清晰的可维护性或投入优势。

## 清理与范围保持

- 所有目标服务均已停止，端口 4173 已释放。
- 所有浏览器上下文均已关闭；截图、视频和 trace 均已禁用。
- 修复前和修复后的 detached 工作树在本地保留，用于复现，保持干净且未修改；其 `node_modules` 仍被忽略。
- 未修改或推送目标分支，未创建 PR 或 Issue。
- 旧 ReproLock 工作树、`integration/wave1` 和备份 stash 均未改动。
- 未启动 provider、GitHub Action、Mutation、WebMCP、包发布、网站或第二个目标的工作。

最终判定：**`SPIKE_CONDITIONAL`**。产品 `GO`：**尚未获得**。

## 恢复复核 — 2026-09-04

前文描述的是 2026-09-01 实验及当时执行的检查。恢复工作时，格式检查及四项单元测试失败，证据包校验器报告八个问题。那些历史成功陈述没有被用作当前验收证据。

未提交的 run-envelope 设计在导入旧报告时采样当前源码哈希，无法证明历史运行时来源，因此已移除。v1 摘要契约、全部九份冻结假设文件、原始四十次尝试和原始报告保持不变。旧清单保留于 `history/2026-09-01-manifest.json`；根清单现在覆盖经过复核的当前证据包。校验建立的是完整性和内部一致性，并非经过认证的执行历史。

修复后的导入器要求二十个唯一测试 ID，每个 spec 恰好一个测试／结果，显式零重试，正确的失败语义，且通过结果不附带错误。它在写入前检查冻结／核心输入，并拒绝用不同内容替换已有运行证据。测试还拒绝最小化数据损坏、空执行分支、不透明错误、路径泄露与重定向。

`revalidation/2026-09-04/` 中的新证据记录了生成测试及人工基线测试：修复前 20/20 次预期失败，修复后 20/20 次通过，零重试、零模型调用。每侧执行前后都检查了目标 HEAD 与干净状态。源码／配置／锁文件／报告哈希在此次执行期间采集，没有填入旧实验。未改变的独立 spec SHA-256 仍为 `d750b422a2452e1fe299ee893f65e673831e4b51085d9e4a8590772c830280ad`。

在 Windows 上，分别使用正在运行的 Playwright／浏览器进程树实际检验了取消和超时：每项测试观察到七个归本任务所有的进程，残留进程为零。正常修复后包装器重放通过 1/1。两个归本任务所有的目标进程树均已停止；外部版本工作树保持干净。这些是本地进程清理结果，不是对所有操作系统的承诺。

`SPIKE_CONDITIONAL` 及人工基线下的价值限制保持不变。下一次产品决策需要责任方提供一个结构较少的案例，并确认其范围；尚未开始第二个案例或生产实现。最终工程命令和远程交付记录在 `harness/context/02-local-functional-regression-spike-a.md`。
