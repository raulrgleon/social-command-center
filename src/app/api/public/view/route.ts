import { prisma } from "@/lib/db";
import { json, limit } from "@/lib/http";

export async function POST(request: Request) {
  const blocked = limit(request, "view", 30, 60 * 1000);
  if (blocked) return json({ ok: true });
  const body = await request.json().catch(() => null);
  const path = typeof body?.path === "string" ? body.path.slice(0, 120) : "/";
  if (!path.startsWith("/")) return json({ ok: true });
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  await prisma.pageView.upsert({
    where: { path_day: { path, day } },
    update: { count: { increment: 1 } },
    create: { path, day, count: 1 },
  });
  return json({ ok: true });
}
