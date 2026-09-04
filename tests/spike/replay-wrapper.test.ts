import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { promisify } from "node:util";

const run = promisify(execFile);
const options = {
  timeout: 15_000,
  maxBuffer: 1_048_576,
  windowsHide: true,
  env: { ...process.env, TARGET_BASE_URL: "http://127.0.0.1:4173" },
};

test("replay rejects redirects and bounds readiness cancellation and deadlines", async () => {
  let redirectedRequests = 0;
  const destination = createServer((_request, response) => {
    redirectedRequests += 1;
    response.end("outside target");
  });
  await new Promise<void>((resolve) => destination.listen(0, "127.0.0.1", resolve));
  const address = destination.address();
  assert.ok(address && typeof address !== "string");
  let redirect = true;
  const target = createServer((_request, response) => {
    if (redirect) {
      response.writeHead(302, { location: "http://127.0.0.1:" + address.port });
      response.end();
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      target.once("error", reject);
      target.listen(4173, "127.0.0.1", resolve);
    });
    await assert.rejects(
      run(
        process.execPath,
        ["spikes/local-functional-regression/generated/replay-safe-unfollow-163.mjs"],
        options,
      ),
    );
    assert.equal(redirectedRequests, 0);
    redirect = false;
    for (const mode of ["cancelled", "timeout"]) {
      const source =
        "import {replay} from './spikes/local-functional-regression/generated/replay-safe-unfollow-163.mjs'; const control = new AbortController();" +
        (mode === "cancelled" ? "setTimeout(()=>control.abort(),100);" : "") +
        "console.log(JSON.stringify(await replay({signal:control.signal,timeoutMs:" +
        (mode === "cancelled" ? 5000 : 100) +
        "})));";
      const result = await run(process.execPath, ["--input-type=module", "-e", source], options);
      const status = JSON.parse(result.stdout);
      assert.equal(status.status, mode);
      assert.equal(status.exitCode, mode === "cancelled" ? 130 : 124);
    }
  } finally {
    target.closeAllConnections();
    destination.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => target.close(() => resolve())),
      new Promise<void>((resolve) => destination.close(() => resolve())),
    ]);
  }
});
