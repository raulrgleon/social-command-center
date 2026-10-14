import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole } from "@/lib/http";
import { createPost } from "@/lib/posts/service";
import { dispatchPost } from "@/lib/publish/service";
import { getPlatform } from "@/lib/platforms/catalog";

const schema = z.strictObject({
  accountIds: z.array(z.string()).min(1).max(40),
  scheduledFor: z.string().nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const blocked = await import("@/lib/http").then((mod) => mod.limit(request, `publish:${auth.session.membership.workspaceId}`, 60, 60 * 60 * 1000));
  if (blocked) return blocked;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Elige al menos una cuenta." }, 400);
  const scheduledFor = parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) return json({ error: "La fecha no es válida." }, 400);
  const { id } = await context.params;
  const results = await dispatchPost({
    workspaceId: auth.session.membership.workspaceId,
    userId: auth.session.user.id,
    postId: id,
    accountIds: parsed.data.accountIds,
    scheduledFor,
  });
  return json({
    results: results.map((result) => ({
      ...result,
      platform: getPlatform(result.platformId)?.name ?? result.platformId,
    })),
  });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  const source = await prisma.post.findFirst({
    where: { id, workspaceId: auth.session.membership.workspaceId },
    include: { versions: true },
  });
  if (!source) return json({ error: "No está la publicación." }, 404);
  const post = await createPost({
    workspaceId: auth.session.membership.workspaceId,
    authorId: auth.session.user.id,
    title: source.title,
    masterBody: source.masterBody,
    linkUrl: source.linkUrl,
    tone: source.tone,
    brandId: source.brandId,
    campaignId: source.campaignId,
    platformIds: source.versions.map((version) => version.platformId),
    source: "DUPLICATE",
  });
  for (const version of source.versions) {
    await prisma.postVersion.update({
      where: { postId_platformId: { postId: post.id, platformId: version.platformId } },
      data: { title: version.title, body: version.body, linkUrl: version.linkUrl, hashtags: version.hashtags, customized: version.customized },
    });
  }
  return json({ post }, 201);
}
