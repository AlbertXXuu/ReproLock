import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [rawPath, outputPath] = process.argv.slice(2);
if (!rawPath || !outputPath)
  throw new Error("Usage: node summarize.mjs <Playwright JSON> <summary JSON>");
const raw = readFileSync(rawPath);
const report = JSON.parse(raw.toString("utf8").replace(/^\uFEFF/, ""));
const observations = [];
let skipped = 0;
let inconclusive = report.errors?.length ?? 0;

function visit(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status === "skipped") {
          skipped++;
          continue;
        }
        const attachment = result.attachments?.find((item) => item.name === "business-observation");
        if (result.status !== "passed" || !attachment?.body) {
          inconclusive++;
          continue;
        }
        const observation = JSON.parse(Buffer.from(attachment.body, "base64").toString("utf8"));
        if (
          observation.requiredChargeCents !== 2300 ||
          !Array.isArray(observation.committedChargesCents) ||
          !["locator-failure", "business-bug-captured", "false-green", "correct-pass"].includes(
            observation.classification,
          )
        )
          throw new Error(`Invalid business observation: ${spec.title}`);
        observations.push(observation);
      }
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites ?? []) visit(suite);
const counts = {};
for (const observation of observations)
  counts[observation.classification] = (counts[observation.classification] ?? 0) + 1;
const sourceRoot = dirname(fileURLToPath(import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sources = Object.fromEntries(
  [
    "fixture.ts",
    "control.spec.ts",
    "model-proposal.spec.ts",
    "playwright.config.ts",
    "summarize.mjs",
  ].map((name) => [name, hash(readFileSync(join(sourceRoot, name)))]),
);
const summary = {
  schema: "reprolock.healing-preservation.v1",
  caseCount: 1,
  startTime: report.stats.startTime,
  durationMs: report.stats.duration,
  rawReport: { name: basename(rawPath), sha256: hash(raw) },
  sourceSha256AtProjection: sources,
  outerMeasurementStats: report.stats,
  candidateOutcomeCounts: counts,
  skipped,
  inconclusive,
  observationCount: observations.length,
  observations,
  limits:
    "Authored controls and one model proposal; repetitions share one business case. Outer passed means observation validation, not candidate pass. Model generation metadata is recorded separately.",
};
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ observations: observations.length, counts, skipped, inconclusive }));
if (inconclusive > 0 || observations.length === 0) process.exitCode = 1;
