const byId = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="demo-token"]').content;
let showingStored = false;
let lastRuns = "";
let busy = false;
let active = false;
let viewGeneration = 0;
let pendingControl = false;
const labels = {
  preparing: "准备中",
  running: "执行中",
  completed: "执行已结束",
  cancelled: "已取消",
  timeout: "已超时",
  "startup-error": "启动失败",
  "execution-error": "执行错误",
  "cleanup-error": "清理未确认",
};
const results = {
  pass: "通过",
  "functional-failure": "功能失败",
  inconclusive: "无法判定",
  "reset-error": "重置错误",
  "target-startup-error": "启动错误",
  "browser-runtime-error": "执行错误",
};

async function control(action) {
  const response = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-demo-token": token },
    body: "{}",
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "操作失败");
  return value;
}

function display(current, stored = false) {
  if (!current) return;
  const { run, attempts, verification } = current;
  byId("state-badge").textContent =
    `${stored ? "已存记录 · " : ""}${labels[run.status] ?? run.status}`;
  byId("phase").textContent = run.diagnostic ?? run.phase;
  byId("timing").textContent =
    `${stored ? "读取旧记录；未重新执行。" : "本次开始："}${run.startedAt}${run.finishedAt ? ` · 结束：${run.finishedAt}` : ""} · 已开始 ${current.started ?? attempts.length} 次 / 已完成 ${attempts.length} 次`;
  for (const [side, name] of [
    ["pre-fix", "pre"],
    ["post-fix", "post"],
  ]) {
    const count = attempts.filter((entry) => entry.side === side).length;
    byId(`${name}-count`).textContent = `${count} / 20`;
    byId(`${name}-progress`).value = count;
  }
  byId("passes").textContent = attempts.filter((entry) => entry.classification === "pass").length;
  byId("failures").textContent = attempts.filter(
    (entry) => entry.classification === "functional-failure",
  ).length;
  byId("inconclusive").textContent = attempts.filter(
    (entry) => entry.classification === "inconclusive",
  ).length;
  byId("errors").textContent = attempts.filter(
    (entry) => !["pass", "functional-failure", "inconclusive"].includes(entry.classification),
  ).length;
  const first = attempts.find((entry) => entry.firstFailedCheckpoint);
  byId("checkpoint").textContent =
    `首个失败检查点：${first ? `${first.side} #${first.attempt} / ${first.firstFailedCheckpoint}` : "尚无观察"}`;
  byId("observed-count").textContent = `${attempts.length} 次已完成`;
  byId("attempts").replaceChildren(
    ...attempts.map((entry) => {
      const row = document.createElement("tr");
      for (const text of [
        `${entry.side} / ${entry.attempt}`,
        results[entry.classification],
        entry.firstFailedCheckpoint ?? "—",
      ]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.append(cell);
      }
      return row;
    }),
  );
  byId("verification").classList.toggle("confirmed", verification?.differential === true);
  byId("verification").textContent = verification
    ? `完整性：${verification.integrity ? "通过" : "未通过"} · 记录一致性：${verification.consistent ? "通过" : "未通过"} · 20 + 20 差分：${verification.differential ? "独立校验通过" : "未确认"}${verification.issues.length ? `。${verification.issues.join("；")}` : ""}`
    : "进度是暂存观察；执行、报告和清理完成后，再独立校验结论。";
  byId("export").hidden = !verification;
  byId("export").href = `/api/export/${run.id}`;
  byId("export").download = `reprolock-${run.id}.json`;
  byId("run-id").textContent = `output/demo/${run.id}`;
}

async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const response = await fetch("/api/state");
    if (!response.ok) throw new Error("无法读取本地运行状态");
    const state = await response.json();
    active = state.active;
    byId("pre-revision").textContent = state.case.revisions["pre-fix"];
    byId("post-revision").textContent = state.case.revisions["post-fix"];
    byId("start").disabled = state.active || pendingControl;
    byId("cancel").disabled = !state.active;
    byId("check").disabled = state.active;
    if (!showingStored) display(state.current);
    byId("history-verification").textContent = state.historical.verification.ok
      ? "已存完整证据包：一致性与冻结输入校验通过"
      : "已存证据包未通过校验；请检查来源";
    byId("history-json").textContent = JSON.stringify(state.historical, null, 2);
    if (JSON.stringify(state.runs) !== lastRuns) {
      lastRuns = JSON.stringify(state.runs);
      byId("retained-runs").replaceChildren(
        ...state.runs.map((id) => {
          const link = document.createElement("a");
          link.href = `/api/run/${id}`;
          link.textContent = id;
          link.addEventListener("click", async (event) => {
            event.preventDefault();
            if (active || pendingControl) return;
            const requestedView = ++viewGeneration;
            try {
              const response = await fetch(link.href);
              if (!response.ok) throw new Error("这次运行尚未完成归档");
              const stored = await response.json();
              if (active || pendingControl || requestedView !== viewGeneration) return;
              showingStored = true;
              display(stored, true);
              byId("run-heading").scrollIntoView();
            } catch (error) {
              byId("phase").textContent = error.message;
            }
          });
          return link;
        }),
      );
    }
  } catch (error) {
    byId("phase").textContent = `${error.message}；状态未知，不代表运行成功。`;
  } finally {
    busy = false;
  }
}

byId("start").addEventListener("click", async () => {
  pendingControl = true;
  byId("start").disabled = true;
  showingStored = false;
  viewGeneration += 1;
  try {
    await control("start");
    await refresh();
  } catch (error) {
    byId("phase").textContent = error.message;
    byId("start").disabled = false;
  } finally {
    pendingControl = false;
  }
});
byId("cancel").addEventListener("click", async () => {
  byId("cancel").disabled = true;
  try {
    await control("cancel");
    byId("phase").textContent = "正在取消并清理所属进程…";
  } catch (error) {
    byId("phase").textContent = error.message;
  }
});
byId("check").addEventListener("click", async () => {
  byId("check").disabled = true;
  try {
    const result = await control("check");
    byId("prerequisites").textContent = `${result.ok ? "已就绪" : "未就绪"} · ${result.diagnostic}`;
  } catch (error) {
    byId("prerequisites").textContent = error.message;
  } finally {
    byId("check").disabled = false;
  }
});
fetch("/test/safe-unfollow-163.spec.ts")
  .then((response) => {
    if (!response.ok) throw new Error("Source unavailable");
    return response.text();
  })
  .then((source) => {
    byId("test-source").textContent = source;
  })
  .catch(() => {
    byId("test-source").textContent = "源码加载失败，请检查本地资源";
  });
void refresh();
setInterval(() => {
  void refresh();
}, 1_500);
