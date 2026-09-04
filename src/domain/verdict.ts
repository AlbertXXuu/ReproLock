import type { JsonValue } from "../evidence/canonical-json.ts";
import { serializeCanonicalJson } from "../evidence/canonical-json.ts";

/** Portable reference to one evidence file inside an explicit evidence root. */
export type EvidenceRef = {
  readonly path: string;
  readonly sha256: string;
};

/** Observable stages at which an attempt may terminate. */
export type AttemptStage =
  | "planned"
  | "target_started"
  | "reset_completed"
  | "actions_running"
  | "outcome_checked"
  | "persisted"
  | "finalizing";

export type OutcomeVerdict =
  | {
      readonly kind: "pass";
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly kind: "fail";
      readonly firstFailedCheckpoint: {
        readonly id: string;
        readonly expected: JsonValue;
        readonly observed: JsonValue;
      };
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly kind: "inconclusive";
      readonly reasonCode:
        | "oracle_unobservable"
        | "reset_unverified"
        | "state_ambiguous"
        | "timeout";
      readonly message: string;
      readonly evidence: readonly EvidenceRef[];
    };

/** Versioned terminal record. Functional outcome and operational termination remain distinct. */
export type AttemptResult =
  | {
      readonly schemaVersion: 1;
      readonly attemptId: string;
      readonly status: "completed";
      readonly stage: "outcome_checked" | "persisted";
      readonly verdict: OutcomeVerdict;
    }
  | {
      readonly schemaVersion: 1;
      readonly attemptId: string;
      readonly status: "error";
      readonly stage: AttemptStage;
      readonly code: string;
      readonly message: string;
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly schemaVersion: 1;
      readonly attemptId: string;
      readonly status: "cancelled";
      readonly stage: AttemptStage;
      readonly reason: "user" | "deadline";
      readonly evidence: readonly EvidenceRef[];
    }
  | {
      readonly schemaVersion: 1;
      readonly attemptId: string;
      readonly status: "policy_denied";
      readonly stage: AttemptStage;
      readonly code: string;
      readonly message: string;
      readonly evidence: readonly EvidenceRef[];
    };

/** Deterministically serialize a terminal attempt record for hashing and golden verification. */
export function serializeAttemptResult(result: AttemptResult): string {
  return serializeCanonicalJson(result);
}
