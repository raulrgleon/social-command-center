import { addDays, startOfWeek } from "date-fns";
import { prisma } from "@/lib/db";
import { json, requireUser } from "@/lib/http";

export async function GET(request: Request) {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const url = new URL(request.url);
  const anchor = new Date(url.searchParams.get("anchor") || Date.now());
  if (Number.isNaN(anchor.getTime())) return json({ error: "Fecha no válida." }, 400);
  const from = startOfWeek(addDays(anchor, -7), { weekStartsOn: 1 });
  const to = addDays(from, 45);
  const platformId = url.searchParams.get("platform") || undefined;
  const posts = await prisma.post.findMany({
    where: {
      workspaceId: auth.session.membership.workspaceId,
      status: { not: "ARCHIVED" },
      OR: [{ plannedFor: { gte: from, lt: to } }, { operations: { some: { scheduledFor: { gte: from, lt: to } } } }, { updatedAt: { gte: from, lt: to } }],
      ...(platformId ? { versions: { some: { platformId } } } : {}),
    },
    include: { versions: true, operations: true },
    orderBy: { plannedFor: "asc" },
  });
  return json({
    from: from.toISOString(),
    to: to.toISOString(),
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title || post.masterBody.slice(0, 80),
      status: post.status,
      isDemo: post.isDemo,
      plannedFor: post.plannedFor?.toISOString() ?? null,
      platforms: post.versions.map((version) => version.platformId),
      operations: post.operations.map((operation) => ({
        id: operation.id,
        platformId: operation.platformId,
        status: operation.status,
        scheduledFor: operation.scheduledFor?.toISOString() ?? null,
        isDemo: operation.isDemo,
      })),
    })),
  });
}
