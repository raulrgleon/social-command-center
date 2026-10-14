import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole, requireUser } from "@/lib/http";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const templates = await prisma.template.findMany({ where: { workspaceId: auth.session.membership.workspaceId }, orderBy: { updatedAt: "desc" } });
  return json({ templates });
}

const schema = z.strictObject({
  name: z.string().min(2).max(80),
  masterBody: z.string().max(50000),
  tone: z.string().max(40).default("informativo"),
  versions: z.array(z.object({ platformId: z.string(), title: z.string(), body: z.string(), linkUrl: z.string(), hashtags: z.array(z.string()) })).max(20),
});

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "La plantilla no es válida." }, 400);
  const template = await prisma.template.create({ data: { workspaceId: auth.session.membership.workspaceId, ...parsed.data } });
  return json({ template }, 201);
}
