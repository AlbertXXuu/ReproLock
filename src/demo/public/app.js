const byId = (id) => document.getElementById(id);
const token = document.querySelector('meta[name="demo-token"]').content;
let showingStored = false;
let lastRuns = "";
let busy = false;
let active = false;
let viewGeneration = 0;
let pendingControl = false;
const labels = {
  preparing: "Preparing",
  running: "Running",
  completed: "Execution finished",
  cancelled: "Cancelled",
  timeout: "Timed out",
  "startup-error": "Startup failed",
  "execution-error": "Execution error",
  "cleanup-error": "Cleanup unverified",
};
const results = {
  pass: "Passed",
  "functional-failure": "Functional failure",
  inconclusive: "Inconclusive",
  "reset-error": "Reset error",
  "target-startup-error": "Target startup error",
  "browser-runtime-error": "Browser runtime error",
};

async function control(action) {
  const response = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-demo-token": token },
    body: "{}",
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Operation failed");
  return value;
}

function display(current, stored = false) {
  if (!current) return;
  const { run, attempts, verification } = current;
  byId("state-badge").textContent =
    `${stored ? "Saved run · " : ""}${labels[run.status] ?? run.status}`;
  byId("phase").textContent = run.diagnostic ?? run.phase;
  byId("timing").textContent =
    `${stored ? "Not re-executed. Started: " : "Started: "}${run.startedAt}${run.finishedAt ? ` · Finished: ${run.finishedAt}` : ""} · ${current.started ?? attempts.length} started / ${attempts.length} completed`;
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
    `First failed checkpoint: ${first ? `${first.side} #${first.attempt} / ${first.firstFailedCheckpoint}` : "none observed"}`;
  byId("observed-count").textContent = `${attempts.length} completed`;
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
    ? `Integrity: ${verification.integrity ? "Passed" : "Failed"} · Record consistency: ${verification.consistent ? "Passed" : "Failed"} · 20 + 20 differential: ${verification.differential ? "Independently verified" : "Unconfirmed"}${verification.issues.length ? `. ${verification.issues.join("; ")}` : ""}`
    : "Progress is provisional. Independent verification follows execution, reporting and cleanup.";
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
    if (!response.ok) throw new Error("Could not read local run state");
    const state = await response.json();
    active = state.active;
    byId("pre-revision").textContent = state.case.revisions["pre-fix"];
    byId("post-revision").textContent = state.case.revisions["post-fix"];
    byId("start").disabled = state.active || pendingControl;
    byId("cancel").disabled = !state.active;
    byId("check").disabled = state.active;
    if (!showingStored) display(state.current);
    byId("history-verification").textContent = state.historical.verification.ok
      ? "Stored bundle: consistency and frozen inputs verified"
      : "Stored bundle verification failed; inspect the source";
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
              if (!response.ok) throw new Error("This run has not finished archiving");
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
    byId("phase").textContent =
      `${error.message}. Run state is unknown; success has not been established.`;
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
    byId("phase").textContent = "Cancelling and cleaning up owned processes…";
  } catch (error) {
    byId("phase").textContent = error.message;
  }
});
byId("check").addEventListener("click", async () => {
  byId("check").disabled = true;
  try {
    const result = await control("check");
    byId("prerequisites").textContent =
      `${result.ok ? "Ready" : "Not ready"} · ${result.diagnostic}`;
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
    byId("test-source").textContent = "Source could not be loaded; check local resources";
  });
void refresh();
setInterval(() => {
  void refresh();
}, 1_500);
