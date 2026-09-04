import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Replay the frozen case. Cancellation owns only the Playwright process tree, not the target. */
export async function replay({ repeat = 1, signal, timeoutMs = repeat * 30_000 + 30_000 } = {}) {
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100) {
    throw new Error("--repeat must be an integer from 1 through 100");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_030_000) {
    throw new Error("Replay timeout must be bounded to 1..3030000 ms");
  }
  const targetUrl = new URL(process.env.TARGET_BASE_URL ?? "http://127.0.0.1:4173");
  if (
    targetUrl.origin !== "http://127.0.0.1:4173" ||
    targetUrl.username !== "" ||
    targetUrl.password !== "" ||
    targetUrl.pathname !== "/" ||
    targetUrl.search !== "" ||
    targetUrl.hash !== ""
  ) {
    throw new Error("TARGET_BASE_URL must be the loopback origin http://127.0.0.1:4173");
  }
  const deadline = AbortSignal.timeout(timeoutMs);
  const abort = AbortSignal.any([deadline, ...(signal ? [signal] : [])]);
  const stopped = () => ({
    exitCode: signal?.aborted ? 130 : 124,
    status: signal?.aborted ? "cancelled" : "timeout",
  });
  let response;
  try {
    response = await fetch(new URL("/upload", targetUrl), {
      redirect: "error",
      signal: AbortSignal.any([abort, AbortSignal.timeout(10_000)]),
    });
    if (!response.ok) throw new Error(`Target readiness failed with HTTP ${response.status}`);
  } catch (error) {
    if (abort.aborted) return stopped();
    throw error;
  } finally {
    await response?.body?.cancel();
  }
  if (abort.aborted) return stopped();

  const child = spawn(
    process.execPath,
    [
      resolve("node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      resolve("spikes/local-functional-regression/generated/playwright.config.ts"),
      `--repeat-each=${repeat}`,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, TARGET_BASE_URL: targetUrl.origin },
      stdio: "inherit",
      windowsHide: true,
      detached: process.platform !== "win32",
    },
  );
  let cleanupError;
  let cleanupTimer;
  let rejectCompletion;
  const terminate = () => {
    if (!child.pid) return;
    cleanupTimer = setTimeout(() => {
      child.unref();
      rejectCompletion(new Error("Playwright cleanup did not complete within 5 seconds"));
    }, 5_000);
    if (process.platform === "win32") {
      const result = spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        timeout: 5_000,
        windowsHide: true,
        stdio: "ignore",
      });
      if (result.error || result.status !== 0)
        cleanupError = new Error("Playwright process-tree cleanup failed");
    } else {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") cleanupError = error;
      }
    }
  };
  const completion = new Promise((accept, reject) => {
    rejectCompletion = reject;
    child.once("error", reject);
    child.once("close", (code) => accept(code ?? 1));
  });
  abort.addEventListener("abort", terminate, { once: true });
  if (abort.aborted) terminate();
  try {
    const code = await completion;
    if (cleanupError) throw cleanupError;
    return abort.aborted ? stopped() : { exitCode: code, status: "completed" };
  } finally {
    clearTimeout(cleanupTimer);
    abort.removeEventListener("abort", terminate);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (
    args.length !== 0 &&
    (args.length !== 2 || args[0] !== "--repeat" || !/^(?:[1-9]|[1-9]\d|100)$/u.test(args[1]))
  ) {
    console.error("Usage: replay-safe-unfollow-163.mjs [--repeat 1..100]");
    process.exit(2);
  }
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const result = await replay({
      repeat: args.length ? Number(args[1]) : 1,
      signal: cancellation.signal,
    });
    process.exitCode = result.exitCode;
  } catch {
    console.error("Replay failed: check loopback readiness, arguments, and process cleanup.");
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}
