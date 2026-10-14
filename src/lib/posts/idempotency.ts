import { createHash } from "node:crypto";

export function operationKey(postId: string, accountId: string, slot: string) {
  return createHash("sha256").update(`${postId}:${accountId}:${slot}`).digest("hex");
}

export function immediateSlot() {
  return "immediate";
}

export function scheduleSlot(date: Date) {
  return `schedule:${date.toISOString()}`;
}

const OPEN_STATUSES = new Set(["PENDING", "SCHEDULED", "PUBLISHING", "PUBLISHED"]);

export function canOpenAnotherOperation(status: string | null, externalId: string | null) {
  if (!status) return true;
  if (OPEN_STATUSES.has(status)) return false;
  if (externalId) return false;
  return status === "FAILED" || status === "CANCELLED" || status === "MANUAL_REQUIRED" || status === "NEEDS_AUTH" || status === "NOT_COMPATIBLE";
}

export function canRetry(input: { status: string; externalId: string | null; retryable: boolean; attemptCount: number }) {
  if (input.externalId) return false;
  if (input.status !== "FAILED" && input.status !== "NEEDS_AUTH") return false;
  if (!input.retryable) return false;
  return input.attemptCount < 5;
}
