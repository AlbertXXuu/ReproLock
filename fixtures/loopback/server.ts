import { createServer } from "node:http";
import type { Socket } from "node:net";

const fixtureHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ReproLock loopback fixture</title>
  </head>
  <body>
    <main>
      <h1>Notification preferences</h1>
      <label><input id="product-updates" type="checkbox" /> Product updates</label>
      <output id="status" aria-live="polite"></output>
    </main>
    <script>
      const checkbox = document.querySelector("#product-updates");
      const status = document.querySelector("#status");
      const render = () => {
        const enabled = localStorage.getItem("product-updates") === "enabled";
        checkbox.checked = enabled;
        status.textContent = enabled ? "Saved: enabled" : "Saved: disabled";
      };
      checkbox.addEventListener("change", () => {
        localStorage.setItem("product-updates", checkbox.checked ? "enabled" : "disabled");
        render();
      });
      render();
    </script>
  </body>
</html>`;

export type LoopbackFixture = {
  readonly origin: string;
  readonly close: () => Promise<void>;
};

/** Start a synthetic fixture on an ephemeral loopback port. */
export async function startLoopbackFixture(): Promise<LoopbackFixture> {
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      });
      response.end('{"status":"ok"}\n');
      return;
    }

    if (request.method === "GET" && requestUrl.pathname === "/") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      });
      response.end(fixtureHtml);
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    const onError = (error: Error): void => rejectListen(error);
    server.once("error", onError);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", onError);
      resolveListen();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    throw new Error("Loopback fixture did not expose a TCP port");
  }

  let closePromise: Promise<void> | undefined;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => {
      if (closePromise !== undefined) {
        return closePromise;
      }

      closePromise = new Promise<void>((resolveClose, rejectClose) => {
        let settled = false;
        const finish = (error?: Error): void => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(deadline);
          if (error === undefined) {
            resolveClose();
          } else {
            rejectClose(error);
          }
        };
        const deadline = setTimeout(() => {
          server.closeAllConnections();
          for (const socket of sockets) {
            socket.destroy();
          }
          finish(new Error("Loopback fixture cleanup exceeded 1000 ms"));
        }, 1_000);

        try {
          server.close((error) => finish(error));
          server.closeAllConnections();
          for (const socket of sockets) {
            socket.destroy();
          }
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      });

      return closePromise;
    },
  };
}
