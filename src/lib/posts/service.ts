import { prisma } from "@/lib/db";
import { getPlatform } from "@/lib/platforms/catalog";
import { syncMaster, versionFromMaster, type MasterContent } from "@/lib/posts/versions";

const postInclude = {
  versions: true,
  media: { include: { media: true }, orderBy: { order: "asc" as const } },
  operations: { orderBy: { createdAt: "desc" as const } },
  brand: true,
  campaign: true,
};

export function presentPost(post: {
  id: string;
  title: string;
  masterBody: string;
  linkUrl: string;
  status: string;
  source: string;
  tone: string;
  isDemo: boolean;
  plannedFor: Date | null;
  brandId: string | null;
  campaignId: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{ id: string; platformId: string; title: string; body: string; hashtags: string[]; linkUrl: string; customized: boolean }>;
  media: Array<{ order: number; media: { id: string; kind: string; filename: string; mimeType: string; sizeBytes: number } }>;
  operations: Array<{ id: string; accountId: string; platformId: string; status: string; scheduledFor: Date | null; completedAt: Date | null; externalId: string | null; externalUrl: string | null; errorCode: string | null; errorMessage: string | null; attemptCount: number; retryable: boolean; resultSource: string; isDemo: boolean }>;
}) {
  return {
    ...post,
    plannedFor: post.plannedFor?.toISOString() ?? null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    media: post.media.map((item) => ({ order: item.order, ...item.media })),
    operations: post.operations.map((item) => ({
      ...item,
      scheduledFor: item.scheduledFor?.toISOString() ?? null,
      completedAt: item.completedAt?.toISOString() ?? null,
    })),
  };
}

export async function createPost(input: {
  workspaceId: string;
  authorId: string;
  title?: string;
  masterBody?: string;
  linkUrl?: string;
  tone?: string;
  brandId?: string | null;
  campaignId?: string | null;
  platformIds?: string[];
  plannedFor?: Date | null;
  source?: "MANUAL" | "AI" | "URL" | "TEMPLATE" | "DUPLICATE";
}) {
  const master: MasterContent = {
    title: input.title?.trim() ?? "",
    body: input.masterBody ?? "",
    linkUrl: input.linkUrl?.trim() ?? "",
    hashtags: [],
  };
  const platformIds = (input.platformIds ?? []).filter((id) => getPlatform(id));
  const post = await prisma.post.create({
    data: {
      workspaceId: input.workspaceId,
      authorId: input.authorId,
      title: master.title,
      masterBody: master.body,
      linkUrl: master.linkUrl,
      tone: input.tone || "informativo",
      brandId: input.brandId ?? null,
      campaignId: input.campaignId ?? null,
      plannedFor: input.plannedFor ?? null,
      source: input.source ?? "MANUAL",
      versions: { create: platformIds.map((platformId) => versionFromMaster(platformId, master)) },
    },
    include: postInclude,
  });
  return presentPost(post);
}

export async function updatePost(input: {
  workspaceId: string;
  postId: string;
  title?: string;
  masterBody?: string;
  linkUrl?: string;
  tone?: string;
  brandId?: string | null;
  campaignId?: string | null;
  plannedFor?: Date | null;
  platformIds?: string[];
  mediaIds?: string[];
}) {
  const post = await prisma.post.findFirst({ where: { id: input.postId, workspaceId: input.workspaceId }, include: { versions: true } });
  if (!post) return null;
  const master: MasterContent = {
    title: input.title ?? post.title,
    body: input.masterBody ?? post.masterBody,
    linkUrl: input.linkUrl ?? post.linkUrl,
    hashtags: [],
  };
  const synced = syncMaster(
    post.versions.map((version) => ({
      platformId: version.platformId,
      title: version.title,
      body: version.body,
      linkUrl: version.linkUrl,
      hashtags: version.hashtags,
      customized: version.customized,
    })),
    master,
  );
  await prisma.post.update({
    where: { id: post.id },
    data: {
      title: master.title,
      masterBody: master.body,
      linkUrl: master.linkUrl,
      tone: input.tone ?? post.tone,
      brandId: input.brandId === undefined ? post.brandId : input.brandId,
      campaignId: input.campaignId === undefined ? post.campaignId : input.campaignId,
      plannedFor: input.plannedFor === undefined ? post.plannedFor : input.plannedFor,
    },
  });
  for (const version of synced) {
    await prisma.postVersion.update({
      where: { postId_platformId: { postId: post.id, platformId: version.platformId } },
      data: { title: version.title, body: version.body, linkUrl: version.linkUrl, hashtags: version.hashtags, customized: version.customized },
    });
  }
  if (input.platformIds) {
    const wanted = new Set(input.platformIds.filter((id) => getPlatform(id)));
    for (const id of wanted) {
      if (!post.versions.some((version) => version.platformId === id)) {
        await prisma.postVersion.create({ data: { postId: post.id, ...versionFromMaster(id, master) } });
      }
    }
  }
  if (input.plannedFor !== undefined && input.plannedFor && post.plannedFor) {
    const delta = input.plannedFor.getTime() - post.plannedFor.getTime();
    const scheduled = await prisma.publishOperation.findMany({ where: { postId: post.id, status: "SCHEDULED", scheduledFor: { not: null } } });
    for (const operation of scheduled) {
      if (!operation.scheduledFor) continue;
      await prisma.publishOperation.update({
        where: { id: operation.id },
        data: { scheduledFor: new Date(operation.scheduledFor.getTime() + delta) },
      });
    }
  }
  if (input.mediaIds) {
    const owned = await prisma.mediaAsset.findMany({ where: { workspaceId: input.workspaceId, id: { in: input.mediaIds } }, select: { id: true } });
    const ids = owned.map((item) => item.id);
    await prisma.postMedia.deleteMany({ where: { postId: post.id, mediaId: { notIn: ids } } });
    for (const [index, id] of ids.entries()) {
      await prisma.postMedia.upsert({
        where: { postId_mediaId: { postId: post.id, mediaId: id } },
        update: { order: index },
        create: { postId: post.id, mediaId: id, order: index },
      });
    }
  }
  const fresh = await prisma.post.findUniqueOrThrow({ where: { id: post.id }, include: postInclude });
  return presentPost(fresh);
}

export async function updateVersion(input: {
  workspaceId: string;
  postId: string;
  platformId: string;
  title: string;
  body: string;
  linkUrl: string;
  hashtags: string[];
}) {
  const post = await prisma.post.findFirst({ where: { id: input.postId, workspaceId: input.workspaceId } });
  if (!post || !getPlatform(input.platformId)) return null;
  const version = await prisma.postVersion.upsert({
    where: { postId_platformId: { postId: post.id, platformId: input.platformId } },
    update: { title: input.title, body: input.body, linkUrl: input.linkUrl, hashtags: input.hashtags, customized: true },
    create: { postId: post.id, platformId: input.platformId, title: input.title, body: input.body, linkUrl: input.linkUrl, hashtags: input.hashtags, customized: true },
  });
  return version;
}

export { postInclude };
