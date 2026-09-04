import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyEvidenceBundle } from "../../spikes/local-functional-regression/tools/evidence-cli.ts";
import { CASE, verifyDemoExport } from "./evidence.ts";
import { checkPrerequisites, DemoRunner, readConfig } from "./run.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicFiles: Record<string, [string, string]> = {
  "/": ["src/demo/public/index.html", "text/html; charset=utf-8"],
  "/app.js": ["src/demo/public/app.js", "text/javascript; charset=utf-8"],
  "/app.css": ["src/demo/public/app.css", "text/css; charset=utf-8"],
  "/assets/alvenx-wordmark.svg": ["docs/assets/alvenx-wordmark.svg", "image/svg+xml"],
  "/assets/alvenx-monogram.svg": ["docs/assets/alvenx-monogram.svg", "image/svg+xml"],
  "/assets/alvenx-ui.css": ["docs/assets/alvenx-ui.css", "text/css; charset=utf-8"],
  "/assets/InstrumentSans-wdth-wght.woff2": [
    "docs/assets/InstrumentSans-wdth-wght.woff2",
    "font/woff2",
  ],
  "/assets/InstrumentSans-OFL.txt": [
    "docs/assets/InstrumentSans-OFL.txt",
    "text/plain; charset=utf-8",
  ],
  "/test/safe-unfollow-163.spec.ts": [
    "spikes/local-functional-regression/generated/safe-unfollow-163.spec.ts",
    "text/plain; charset=utf-8",
  ],
  "/test/playwright.config.ts": [
    "spikes/local-functional-regression/generated/playwright.config.ts",
    "text/plain; charset=utf-8",
  ],
};

/** Serve only the supplied case and explicit repository resources on loopback. */
export async function startDemo(options: {
  configPath: string;
  port?: number;
  root?: string;
}): Promise<{ address: string; close: () => Promise<void> }> {
  const root = options.root ?? repositoryRoot;
  const runner = new DemoRunner(root, await readConfig(options.configPath));
  const token = randomBytes(24).toString("hex");
  const historical = {
    label: "Stored experiment — not a new execution",
    dates: ["2026-09-01", "2026-09-04"],
    source: "spikes/local-functional-regression/revalidation/2026-09-04/execution.json",
    verification: await verifyEvidenceBundle(join(root, "spikes/local-functional-regression")),
    summary: JSON.parse(
      await readFile(
        join(
          root,
          "spikes/local-functional-regression/revalidation/2026-09-04/differential-summary.json",
        ),
        "utf8",
      ),
    ),
  };
  let address = "";
  const server = createServer(async (request, response) => {
    const send = (code: number, value: unknown): void => {
      response.writeHead(code, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(value));
    };
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    try {
      if (request.headers.host !== new URL(address).host) {
        send(403, { error: "Loopback Host required" });
        return;
      }
      const url = new URL(request.url ?? "/", address);
      if (request.method === "POST") {
        if (
          request.headers.origin !== address ||
          request.headers["x-demo-token"] !== token ||
          request.headers["content-type"] !== "application/json"
        ) {
          send(403, { error: "Use this local Demo page to control its runner" });
          return;
        }
        let body = "";
        for await (const chunk of request) {
          body += String(chunk);
          if (body.length > 256) {
            send(413, { error: "Control request too large" });
            return;
          }
        }
        if (body !== "{}") {
          send(400, { error: "Only the configured case may be run" });
          return;
        }
        if (url.pathname === "/api/start") {
          if (runner.active) {
            send(409, { error: "One run is already active" });
            return;
          }
          send(202, { id: await runner.start() });
          return;
        }
        if (url.pathname === "/api/cancel") {
          runner.cancel();
          send(202, { cancelling: runner.active });
          return;
        }
        if (url.pathname === "/api/check") {
          send(200, await checkPrerequisites(root, runner.config));
          return;
        }
        send(404, { error: "Unknown control" });
        return;
      }
      if (request.method !== "GET") {
        send(405, { error: "Method not supported" });
        return;
      }
      if (url.pathname === "/api/state") {
        let runs: string[] = [];
        try {
          runs = (await readdir(join(root, "output/demo"), { withFileTypes: true }))
            .filter((entry) => entry.isDirectory() && /^[0-9TZ]+-[a-f0-9]{8}$/u.test(entry.name))
            .map((entry) => entry.name)
            .sort()
            .reverse()
            .slice(0, 30);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        send(200, {
          case: CASE,
          stage: "SPIKE_CONDITIONAL",
          historical,
          active: runner.active,
          current: await runner.refresh(),
          runs,
          timeoutMs: runner.config.timeoutMs,
        });
        return;
      }
      const match = /^\/api\/(export|run)\/([0-9TZ]+-[a-f0-9]{8})$/u.exec(url.pathname);
      if (match) {
        const bundle = JSON.parse(
          await readFile(join(root, "output/demo", match[2] ?? "", "export.json"), "utf8"),
        );
        if (match[1] === "export") {
          response.setHeader(
            "Content-Disposition",
            `attachment; filename="reprolock-${match[2]}.json"`,
          );
          send(200, bundle);
        } else {
          const final = JSON.parse(
            await readFile(join(root, "output/demo", match[2] ?? "", "final.json"), "utf8"),
          );
          send(200, {
            run: JSON.parse(bundle.files["run.json"]),
            attempts: JSON.parse(bundle.files["attempts.json"]),
            started: final.started,
            verification: verifyDemoExport(bundle),
          });
        }
        return;
      }
      const file = publicFiles[url.pathname];
      if (file) {
        let contents = await readFile(join(root, file[0]));
        if (url.pathname === "/")
          contents = Buffer.from(contents.toString("utf8").replace("DEMO_CONTROL_TOKEN", token));
        response.writeHead(200, { "content-type": file[1] });
        response.end(contents);
        return;
      }
      send(404, { error: "Resource not found" });
    } catch {
      send(500, { error: "Local operation failed; check prerequisites or retained run files" });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxConnections = 32;
  await new Promise<void>((accept, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4317, "127.0.0.1", accept);
  });
  const bound = server.address();
  if (!bound || typeof bound === "string") throw new Error("Loopback server did not bind");
  address = `http://127.0.0.1:${bound.port}`;
  return {
    address,
    close: async () => {
      await runner.shutdown();
      server.closeAllConnections();
      await new Promise<void>((accept) => server.close(() => accept()));
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  let configPath = resolve("demo.local.json");
  let port = 4317;
  for (let index = 0; index < args.length; index += 2) {
    const value = args[index + 1];
    if (!value) throw new Error("Usage: pnpm demo --config demo.local.json [--port 4317]");
    if (args[index] === "--config") configPath = resolve(value);
    else if (args[index] === "--port" && /^\d+$/u.test(value) && Number(value) <= 65535)
      port = Number(value);
    else throw new Error("Unknown Demo argument");
  }
  const demo = await startDemo({ configPath, port });
  console.log(`ReproLock single-case Demo: ${demo.address}`);
  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    void demo.close().then(() => {
      process.exitCode = 0;
    });
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
