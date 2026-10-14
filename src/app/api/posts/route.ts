import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole } from "@/lib/http";
import { createPost, postInclude, presentPost } from "@/lib/posts/service";

const schema = z.strictObject({
  title: z.string().max(300).optional(),
  masterBody: z.string().max(50000).optional(),
  linkUrl: z.string().max(2000).optional(),
  tone: z.string().max(40).optional(),
  brandId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  platformIds: z.array(z.string().max(40)).max(20).optional(),
  plannedFor: z.string().nullable().optional(),
});

export async function GET() {
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const posts = await prisma.post.findMany({
    where: { workspaceId: auth.session.membership.workspaceId },
    include: postInclude,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return json({ posts: posts.map(presentPost) });
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "La publicación no es válida." }, 400);
  const plannedFor = parsed.data.plannedFor ? new Date(parsed.data.plannedFor) : null;
  if (parsed.data.plannedFor && Number.isNaN(plannedFor?.getTime())) return json({ error: "La fecha no es válida." }, 400);
  const post = await createPost({
    workspaceId: auth.session.membership.workspaceId,
    authorId: auth.session.user.id,
    ...parsed.data,
    plannedFor,
  });
  return json({ post }, 201);
}
