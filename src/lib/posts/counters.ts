import { inRange, zonedDayRange } from "@/lib/posts/time";

export type CountStatus =
  | "PENDING"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "NEEDS_AUTH"
  | "MANUAL_REQUIRED"
  | "NOT_COMPATIBLE"
  | "CANCELLED";

export type CountableOperation = {
  platformId: string;
  status: CountStatus;
  completedAt: Date | null;
  scheduledFor: Date | null;
  resultSource: "LOCAL" | "EXTERNAL_SYNC";
  isDemo: boolean;
};

export type CountableExternal = {
  platformId: string;
  publishedAt: Date;
  isDemo?: boolean;
};

export type PlatformDayCount = {
  localPublished: number;
  externalPublished: number;
  scheduled: number;
  errors: number;
  manualRequired: number;
  demoScheduled: number;
};

const empty = (): PlatformDayCount => ({
  localPublished: 0,
  externalPublished: 0,
  scheduled: 0,
  errors: 0,
  manualRequired: 0,
  demoScheduled: 0,
});

export function summarizeActivity(
  operations: CountableOperation[],
  externals: CountableExternal[],
  now: Date,
  timeZone: string,
) {
  const { start, end, label } = zonedDayRange(now, timeZone);
  const byPlatform = new Map<string, PlatformDayCount>();
  const bucket = (platformId: string) => {
    const current = byPlatform.get(platformId) ?? empty();
    byPlatform.set(platformId, current);
    return current;
  };

  for (const operation of operations) {
    const row = bucket(operation.platformId);
    if (operation.status === "PUBLISHED" && operation.resultSource === "LOCAL" && !operation.isDemo && inRange(operation.completedAt, start, end)) {
      row.localPublished += 1;
    }
    if (operation.status === "SCHEDULED" && !operation.isDemo) row.scheduled += 1;
    if (operation.status === "SCHEDULED" && operation.isDemo) row.demoScheduled += 1;
    if ((operation.status === "FAILED" || operation.status === "NEEDS_AUTH") && !operation.isDemo) row.errors += 1;
    if ((operation.status === "MANUAL_REQUIRED" || operation.status === "NOT_COMPATIBLE") && !operation.isDemo) {
      row.manualRequired += 1;
    }
  }

  for (const external of externals) {
    if (external.isDemo) continue;
    if (!inRange(external.publishedAt, start, end)) continue;
    bucket(external.platformId).externalPublished += 1;
  }

  const totals = empty();
  for (const row of byPlatform.values()) {
    totals.localPublished += row.localPublished;
    totals.externalPublished += row.externalPublished;
    totals.scheduled += row.scheduled;
    totals.errors += row.errors;
    totals.manualRequired += row.manualRequired;
    totals.demoScheduled += row.demoScheduled;
  }

  return { day: label, start, end, byPlatform, totals };
}
