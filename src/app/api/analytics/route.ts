import { prisma } from "@/lib/db";
import { json, requireUser } from "@/lib/http";
import { inRange, zonedDayRange, shiftZonedDay } from "@/lib/posts/time";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const days = new URL(request.url).searchParams.get("range") === "30" ? 30 : 7;
  const workspaceId = auth.session.membership.workspaceId;
  const timeZone = auth.session.user.timezone;
  const now = new Date();
  const today = zonedDayRange(now, timeZone);
  const start = shiftZonedDay(today.start, timeZone, -(days - 1));
  const [operations, externals, metrics, scheduled, errors] = await Promise.all([
    prisma.publishOperation.findMany({ where: { workspaceId, isDemo: false, status: "PUBLISHED", resultSource: "LOCAL", completedAt: { gte: start, lt: today.end } } }),
    prisma.externalPost.findMany({ where: { workspaceId, publishedAt: { gte: start, lt: today.end } } }),
    prisma.metricSnapshot.findMany({ where: { workspaceId }, orderBy: { capturedAt: "desc" }, take: 50 }),
    prisma.publishOperation.count({ where: { workspaceId, isDemo: false, status: "SCHEDULED" } }),
    prisma.publishOperation.count({ where: { workspaceId, isDemo: false, status: { in: ["FAILED", "NEEDS_AUTH"] } } }),
  ]);
  const series = [];
  for (let index = 0; index < days; index += 1) {
    const dayStart = shiftZonedDay(start, timeZone, index);
    const day = zonedDayRange(dayStart, timeZone);
    series.push({
      day: day.label,
      local: operations.filter((item) => inRange(item.completedAt, day.start, day.end)).length,
      external: externals.filter((item) => inRange(item.publishedAt, day.start, day.end)).length,
    });
  }
  const byPlatform = new Map<string, number>();
  for (const operation of operations) byPlatform.set(operation.platformId, (byPlatform.get(operation.platformId) ?? 0) + 1);
  for (const external of externals) byPlatform.set(external.platformId, (byPlatform.get(external.platformId) ?? 0) + 1);
  return json({
    range: days,
    today: series.at(-1)?.local ?? 0,
    externalToday: series.at(-1)?.external ?? 0,
    scheduled,
    errors,
    series,
    byPlatform: [...byPlatform.entries()].map(([platformId, count]) => ({ platformId, count })),
    metrics: metrics.map((metric) => ({
      accountId: metric.accountId,
      platformId: metric.platformId,
      availability: metric.availability,
      reach: metric.reach,
      impressions: metric.impressions,
      interactions: metric.interactions,
      note: metric.note,
      capturedAt: metric.capturedAt.toISOString(),
    })),
    note: "Solo entran publicaciones confirmadas. Los datos de demostración no se mezclan aquí.",
  });
}
