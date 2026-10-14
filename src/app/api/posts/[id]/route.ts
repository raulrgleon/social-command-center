import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole, requireUser } from "@/lib/http";
import { postInclude, presentPost, updatePost } from "@/lib/posts/service";

const schema = z.strictObject({
  title: z.string().max(300).optional(),
  masterBody: z.string().max(50000).optional(),
  linkUrl: z.string().max(2000).optional(),
  tone: z.string().max(40).optional(),
  brandId: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  platformIds: z.array(z.string().max(40)).max(20).optional(),
  plannedFor: z.string().nullable().optional(),
  mediaIds: z.array(z.string()).max(10).optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  const post = await prisma.post.findFirst({ where: { id, workspaceId: auth.session.membership.workspaceId }, include: postInclude });
  if (!post) return json({ error: "No está la publicación." }, 404);
  return json({ post: presentPost(post) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "La publicación no es válida." }, 400);
  const plannedFor = parsed.data.plannedFor === undefined ? undefined : parsed.data.plannedFor ? new Date(parsed.data.plannedFor) : null;
  if (plannedFor instanceof Date && Number.isNaN(plannedFor.getTime())) return json({ error: "La fecha no es válida." }, 400);
  const { id } = await context.params;
  const post = await updatePost({ workspaceId: auth.session.membership.workspaceId, postId: id, ...parsed.data, plannedFor });
  if (!post) return json({ error: "No está la publicación." }, 404);
  return json({ post });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  const post = await prisma.post.findFirst({ where: { id, workspaceId: auth.session.membership.workspaceId } });
  if (!post) return json({ error: "No está la publicación." }, 404);
  await prisma.post.update({ where: { id }, data: { status: "ARCHIVED" } });
  return json({ ok: true });
}
