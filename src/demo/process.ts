import { type ChildProcess, execFile, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

const execute = promisify(execFile);
type ProcessIdentity = { pid: number; parent: number; started: string };

/** Windows environment names are case insensitive, including in nested package-manager shells. */
export function childEnvironment(extra: NodeJS.ProcessEnv = {}, inherit = true): NodeJS.ProcessEnv {
  const entries = Object.entries({ ...(inherit ? process.env : {}), ...extra });
  return Object.fromEntries(
    entries.map(([key, value]) => [process.platform === "win32" ? key.toUpperCase() : key, value]),
  );
}

async function snapshot(timeout = 3_000): Promise<ProcessIdentity[]> {
  const windows = process.platform === "win32";
  const { stdout } = await execute(
    windows ? "powershell.exe" : "ps",
    windows
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          'Get-CimInstance Win32_Process | ForEach-Object { "{0} {1} {2}" -f $_.ProcessId,$_.ParentProcessId,$_.CreationDate.ToUniversalTime().Ticks }',
        ]
      : ["-eo", "pid=,ppid=,stat=,lstart="],
    { timeout, windowsHide: true, maxBuffer: 2_097_152, env: childEnvironment() },
  );
  return stdout
    .trim()
    .split(/\r?\n/u)
    .flatMap((line) => {
      const parts = line.trim().split(/\s+/u);
      if (!windows && parts[2]?.startsWith("Z")) return [];
      const pid = Number(parts[0]);
      const parent = Number(parts[1]);
      return Number.isInteger(pid) && pid > 0 && Number.isInteger(parent)
        ? [{ pid, parent, started: parts.slice(windows ? 2 : 3).join(" ") }]
        : [];
    });
}

export type Cleanup = { observed: number; survivors: number; verified: boolean };

/** Own one trusted command and its observed descendants; never terminate a process by port. */
export class OwnedProcess {
  readonly child: ChildProcess;
  readonly closed: Promise<number>;
  readonly identities = new Map<number, ProcessIdentity>();
  output = "";
  exited = false;
  outputExceeded = false;
  private observing: Promise<void> | null = null;
  private readonly timer: NodeJS.Timeout;

  constructor(
    command: string,
    args: string[],
    cwd: string,
    extra: NodeJS.ProcessEnv = {},
    inherit = true,
  ) {
    this.child = spawn(command, args, {
      cwd,
      env: childEnvironment(extra, inherit),
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.closed = new Promise((accept) => {
      this.child.once("error", () => {
        this.exited = true;
        accept(1);
      });
      this.child.once("close", (code) => {
        this.exited = true;
        accept(code ?? 1);
      });
    });
    for (const stream of [this.child.stdout, this.child.stderr]) {
      stream?.setEncoding("utf8");
      stream?.on("data", (chunk: string) => {
        if (this.output.length + chunk.length <= 1_048_576) this.output += chunk;
        else this.outputExceeded = true;
      });
    }
    this.timer = setInterval(() => {
      void this.observe().catch(() => {});
    }, 1_000);
  }

  async observe(): Promise<void> {
    if (this.observing) return this.observing;
    this.observing = (async () => {
      const rows = await snapshot();
      const root = rows.find((row) => row.pid === this.child.pid);
      if (root && !this.exited && !this.identities.has(root.pid))
        this.identities.set(root.pid, root);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of rows) {
          const parent = this.identities.get(row.parent);
          if (
            !this.identities.has(row.pid) &&
            parent &&
            rows.some((current) => current.pid === parent.pid && current.started === parent.started)
          ) {
            this.identities.set(row.pid, row);
            changed = true;
          }
        }
      }
    })().finally(() => {
      this.observing = null;
    });
    await this.observing;
  }

  async stop(): Promise<Cleanup> {
    clearInterval(this.timer);
    const stopBy = Date.now() + 25_000;
    const remaining = () => {
      const ms = stopBy - Date.now();
      if (ms <= 0) throw new Error("Cleanup deadline reached");
      return Math.min(ms, 3_000);
    };
    let inventoryAvailable = true;
    try {
      await this.observe();
    } catch {
      inventoryAvailable = false;
    }
    // Inventory failure must never prevent termination of the child handle we spawned.
    if (
      !this.exited &&
      this.child.pid &&
      this.child.exitCode === null &&
      this.child.signalCode === null
    ) {
      if (process.platform === "win32") {
        await execute("taskkill.exe", ["/PID", String(this.child.pid), "/T", "/F"], {
          timeout: 5_000,
          windowsHide: true,
          env: childEnvironment(),
        }).catch(() => {});
      } else {
        try {
          process.kill(-this.child.pid, "SIGKILL");
        } catch {
          this.child.kill("SIGKILL");
        }
      }
    }
    try {
      const rows = await snapshot(remaining());
      const alive = rows.filter((row) => this.identities.get(row.pid)?.started === row.started);
      if (process.platform !== "win32" && this.child.pid) {
        try {
          process.kill(-this.child.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        }
      }
      for (const row of alive) {
        // Recheck creation identity immediately before any termination to avoid recycled PIDs.
        if (
          !(await snapshot(remaining())).some(
            (current) => current.pid === row.pid && current.started === row.started,
          )
        )
          continue;
        if (process.platform === "win32") {
          await execute("taskkill.exe", ["/PID", String(row.pid), "/T", "/F"], {
            timeout: 5_000,
            windowsHide: true,
            env: childEnvironment(),
          }).catch(() => {});
        } else {
          try {
            process.kill(row.pid, "SIGKILL");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
        }
      }
      await Promise.race([this.closed, delay(remaining())]);
      const after = await snapshot(remaining());
      const survivors = after.filter(
        (row) => this.identities.get(row.pid)?.started === row.started,
      ).length;
      return {
        observed: this.identities.size,
        survivors,
        verified: inventoryAvailable && survivors === 0 && this.exited && this.identities.size > 0,
      };
    } catch {
      // A failed inventory is unknown cleanup, never an asserted zero-survivor observation.
      await Promise.race([this.closed, delay(3_000)]);
      return { observed: this.identities.size, survivors: -1, verified: false };
    }
  }
}
