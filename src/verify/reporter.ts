import { linkSync, unlinkSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";
import { hash, type Observation, type Report, type Step } from "./evidence.ts";

const errorHash = (error: TestError): string =>
  hash(error.message ?? error.value ?? "unknown error");
/** V1 deliberately accepts native value comparisons only; locator/API errors are inconclusive. */
export function nativeComparison(message: string): Step["comparison"] {
  const text = stripVTControlCharacters(message);
  const expected = /^Expected: (.+)$/mu.exec(text)?.[1];
  const received = /^Received: (.+)$/mu.exec(text)?.[1];
  return /expect\(received\)\.toBe\(expected\)/u.test(text) && expected && received
    ? { matcher: "toBe", expected: hash(expected), received: hash(received) }
    : null;
}
function publish(path: string, value: unknown): void {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(value), { flag: "wx" });
  try {
    linkSync(temporary, path);
  } finally {
    unlinkSync(temporary);
  }
}

export default class EvidenceReporter implements Reporter {
  private readonly path: string;
  private readonly report: Report = {
    schemaVersion: 1,
    planned: 0,
    status: "interrupted",
    errors: [],
    observations: [],
  };
  private sequence = 0;
  private current: Step[] = [];
  private readonly steps = new Map<TestStep, Step>();
  private exceeded = false;
  constructor(options: { outputFile: string }) {
    this.path = options.outputFile;
  }
  onBegin(_config: unknown, suite: Suite): void {
    this.report.planned = suite.allTests().length;
  }
  onTestBegin(): void {
    this.sequence = 0;
    this.current = [];
    this.steps.clear();
  }
  onStepBegin(_test: TestCase, _result: TestResult, step: TestStep): void {
    if (this.current.length >= 200) {
      if (!this.exceeded) {
        this.exceeded = true;
        this.report.errors.push(hash("Step budget exceeded"));
      }
      return;
    }
    const entry: Step = {
      id: this.current.length,
      parent: step.parent ? (this.steps.get(step.parent)?.id ?? null) : null,
      category:
        step.category === "expect" || step.category === "test.step" ? step.category : "other",
      label: step.title === "reset" || step.title === "outcome" ? step.title : "other",
      begin: this.sequence++,
      end: -1,
      error: null,
      comparison: null,
      line:
        step.location && basename(step.location.file) === "candidate.spec.ts"
          ? step.location.line
          : null,
      column:
        step.location && basename(step.location.file) === "candidate.spec.ts"
          ? step.location.column
          : null,
    };
    this.current.push(entry);
    this.steps.set(step, entry);
  }
  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep): void {
    const entry = this.steps.get(step);
    if (!entry) return;
    entry.end = this.sequence++;
    entry.error = step.error ? errorHash(step.error) : null;
    entry.comparison =
      step.category === "expect" && step.error ? nativeComparison(step.error.message ?? "") : null;
  }
  onTestEnd(test: TestCase, result: TestResult): void {
    const observation: Observation = {
      repetition: test.repeatEachIndex,
      retry: result.retry,
      expectedStatus: test.expectedStatus,
      status: result.status,
      errors: result.errors.map(errorHash),
      steps: this.current,
    };
    if (this.report.observations.length < 20) {
      this.report.observations.push(observation);
      publish(`${this.path}.partial-${this.report.observations.length}`, this.report);
    } else this.onError({ message: "Observation budget exceeded" });
  }
  onError(error: TestError): void {
    if (this.report.errors.length < 200) this.report.errors.push(errorHash(error));
  }
  onEnd(result: FullResult): void {
    this.report.status = result.status;
    publish(this.path, this.report);
  }
}
