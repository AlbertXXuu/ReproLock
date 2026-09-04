import { closeSync, linkSync, mkdirSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";

/** Keep only known assertion diagnostics, never paths, page content, stacks or environment values. */
export function minimizeMessage(message: string): string {
  const plain = stripVTControlCharacters(message);
  const retained = [
    plain.match(/\[(?:functional|reset|setup|target-startup)-checkpoint:[a-z0-9-]+\]/u)?.[0],
    plain.includes("Analyzing locally...") ? "Analyzing locally..." : undefined,
    /toBeHidden/u.test(plain) ? "toBeHidden" : undefined,
    /Expected:\s*hidden/iu.test(plain) ? "Expected: hidden" : undefined,
    /Received:\s*visible/iu.test(plain) ? "Received: visible" : undefined,
  ].filter((value) => value !== undefined);
  return retained.length
    ? retained.join("\n")
    : "Unclassified execution error (raw diagnostic retained locally)";
}

/** Synchronous atomic publication: a killed reporter retains each already completed observation. */
export default class DemoReporter implements Reporter {
  private readonly root = process.env.REPROLOCK_OBSERVATIONS;
  private put(name: string, value: unknown): void {
    if (!this.root) throw new Error("Explicit observation directory is required");
    mkdirSync(this.root, { recursive: true });
    const temporary = join(this.root, `.${name}.tmp`);
    const descriptor = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(descriptor, serializeCanonicalJson(value));
    } finally {
      closeSync(descriptor);
    }
    try {
      linkSync(temporary, join(this.root, name));
    } finally {
      unlinkSync(temporary);
    }
  }
  onBegin(config: FullConfig): void {
    this.put("begin.json", {
      workers: config.workers,
      repeatEach: config.projects[0]?.repeatEach,
      retries: config.projects[0]?.retries,
      startedAt: new Date().toISOString(),
    });
  }
  onTestBegin(test: TestCase, result: TestResult): void {
    this.put(`started-${test.repeatEachIndex + 1}.json`, {
      attempt: test.repeatEachIndex + 1,
      workerIndex: result.workerIndex,
      at: new Date().toISOString(),
    });
  }
  onTestEnd(test: TestCase, result: TestResult): void {
    this.put(`attempt-${test.repeatEachIndex + 1}.json`, {
      attempt: test.repeatEachIndex + 1,
      workerIndex: result.workerIndex,
      at: new Date().toISOString(),
      result: {
        status: result.status,
        retry: result.retry,
        duration: result.duration,
        errors: result.errors.map((error) => ({ message: minimizeMessage(error.message ?? "") })),
      },
      id: test.id,
      title: test.title,
      file: "safe-unfollow-163.spec.ts",
    });
  }
  onEnd(result: FullResult): void {
    this.put("end.json", { status: result.status, finishedAt: new Date().toISOString() });
  }
}
