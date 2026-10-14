import { prisma } from "@/lib/db";
import { json, requireUser } from "@/lib/http";
import { summarizeActivity } from "@/lib/posts/counters";
import { zonedDayRange } from "@/lib/posts/time";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const workspaceId = auth.session.membership.workspaceId;
  const timeZone = auth.session.user.timezone;
  const [operations, externals, accounts] = await Promise.all([
    prisma.publishOperation.findMany({ where: { workspaceId }, select: { platformId: true, status: true, completedAt: true, scheduledFor: true, resultSource: true, isDemo: true } }),
    prisma.externalPost.findMany({ where: { workspaceId }, select: { platformId: true, publishedAt: true } }),
    prisma.connectedAccount.count({ where: { workspaceId, status: "CONNECTED", isDemo: false } }),
  ]);
  const summary = summarizeActivity(operations, externals, new Date(), timeZone);
  const byPlatform = Object.fromEntries([...summary.byPlatform.entries()]);
  return json({
    day: summary.day,
    timeZone,
    range: zonedDayRange(new Date(), timeZone),
    totals: summary.totals,
    byPlatform,
    connectedAccounts: accounts,
  });
}
