import { Prisma, type OperationStatus } from "@/generated/prisma/client";
import { getAdapter } from "@/lib/adapters/registry";
import type { AccountCredentials } from "@/lib/adapters/types";
import { preparedCopy } from "@/lib/adapters/manual";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getPlatform } from "@/lib/platforms/catalog";
import { blockingIssues, validateVersion } from "@/lib/platforms/validation";
import { canOpenAnotherOperation, immediateSlot, operationKey, scheduleSlot } from "@/lib/posts/idempotency";
import { decryptJson } from "@/lib/security/crypto";
import { readBytes } from "@/lib/storage";

function credentialsOf(account: { tokenCipher: string | null; tokenIv: string | null; tokenTag: string | null }): AccountCredentials {
  if (!account.tokenCipher || !account.tokenIv || !account.tokenTag) return {};
  return decryptJson<AccountCredentials>(account.tokenCipher, account.tokenIv, account.tokenTag);
}

export type DispatchResult = {
  accountId: string;
  platformId: string;
  status: OperationStatus;
  message: string;
  externalId?: string | null;
  manualSteps: string[];
  copyText: string;
};

async function loadMedia(postId: string) {
  const links = await prisma.postMedia.findMany({ where: { postId }, include: { media: true }, orderBy: { order: "asc" } });
  const media = [];
  for (const link of links) {
    const bytes = await readBytes(link.media.storageKey);
    const publicUrl = process.env.S3_PUBLIC_BASE_URL
      ? `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${link.media.storageKey}`
      : undefined;
    media.push({ filename: link.media.filename, mimeType: link.media.mimeType, kind: link.media.kind, bytes, publicUrl });
  }
  return media;
}

export async function dispatchPost(input: {
  workspaceId: string;
  userId: string;
  postId: string;
  accountIds: string[];
  scheduledFor: Date | null;
}) {
  const post = await prisma.post.findFirst({ where: { id: input.postId, workspaceId: input.workspaceId }, include: { versions: true } });
  if (!post) throw new Error("No está la publicación.");
  const uniqueAccounts = [...new Set(input.accountIds)];
  const results: DispatchResult[] = [];
  for (const accountId of uniqueAccounts) {
    try {
      results.push(await dispatchAccount({ ...input, accountId, post }));
    } catch (error) {
      results.push({
        accountId,
        platformId: "",
        status: "FAILED",
        message: error instanceof Error ? error.message : "No se pudo preparar la operación.",
        manualSteps: [],
        copyText: "",
      });
    }
  }
  await refreshPostStatus(post.id);
  await audit({
    workspaceId: input.workspaceId,
    userId: input.userId,
    action: input.scheduledFor ? "post.schedule" : "post.dispatch",
    entityType: "post",
    entityId: post.id,
    metadata: { results: results.map((item) => ({ accountId: item.accountId, status: item.status })) },
  });
  return results;
}

async function dispatchAccount(input: {
  workspaceId: string;
  userId: string;
  postId: string;
  accountId: string;
  scheduledFor: Date | null;
  post: { id: string; title: string; masterBody: string; linkUrl: string; isDemo: boolean; versions: Array<{ id: string; platformId: string; title: string; body: string; hashtags: string[]; linkUrl: string }> };
}): Promise<DispatchResult> {
  const account = await prisma.connectedAccount.findFirst({ where: { id: input.accountId, workspaceId: input.workspaceId } });
  if (!account) throw new Error("La cuenta no pertenece a este espacio.");
  const platform = getPlatform(account.platformId);
  if (!platform) throw new Error("Red desconocida.");
  const version = input.post.versions.find((item) => item.platformId === account.platformId);
  const content = {
    title: version?.title || input.post.title,
    body: version?.body || input.post.masterBody,
    hashtags: version?.hashtags || [],
    linkUrl: version?.linkUrl || input.post.linkUrl,
  };
  const media = await prisma.postMedia.findMany({ where: { postId: input.post.id }, include: { media: true } });
  if (account.status === "CONNECTED" && account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= Date.now()) {
    await prisma.connectedAccount.update({ where: { id: account.id }, data: { status: "NEEDS_REAUTH" } });
    account.status = "NEEDS_REAUTH";
  }
  const issues = blockingIssues(validateVersion(platform, { ...content, mediaKinds: media.map((item) => item.media.kind) }));
  const copyText = preparedCopy(content);
  const base = { accountId: account.id, platformId: account.platformId, manualSteps: platform.manualSteps, copyText };

  const planned = account.isDemo || account.status === "DEMO"
    ? await saveOperation(input, account, version?.id, "MANUAL_REQUIRED", "Las cuentas de demostración no publican en la red.")
    : !platform.publishSupported
      ? await saveOperation(input, account, version?.id, "NOT_COMPATIBLE", platform.summary)
      : issues.length > 0
        ? await saveOperation(input, account, version?.id, "NOT_COMPATIBLE", issues[0].message)
        : input.scheduledFor && input.scheduledFor.getTime() > Date.now() + 15_000
          ? await saveOperation(input, account, version?.id, "SCHEDULED", "Programada en Mesa. Se enviará si la cuenta sigue autorizada.")
          : !account.canPublish || account.status !== "CONNECTED"
            ? await saveOperation(input, account, version?.id, "NEEDS_AUTH", "La cuenta no está autorizada para publicar.")
            : await saveOperation(input, account, version?.id, "PUBLISHING", null);
  if (!planned.execute) {
    const message = planned.row.externalId
      ? "Ya estaba publicada. No se envió de nuevo."
      : planned.row.status === "PUBLISHING"
        ? "Esa cuenta ya tiene un envío en curso."
        : planned.row.errorMessage || "Operación registrada.";
    return { ...base, status: planned.row.externalId ? "PUBLISHED" : planned.row.status, message, externalId: planned.row.externalId };
  }
  return executeOperation(planned.row.id).then((final) => ({ ...base, ...final }));
}

async function saveOperation(
  input: { postId: string; workspaceId: string; scheduledFor: Date | null; post: { isDemo: boolean } },
  account: { id: string; platformId: string },
  versionId: string | undefined,
  status: OperationStatus,
  message: string | null,
) {
  const slot = input.scheduledFor ? scheduleSlot(input.scheduledFor) : immediateSlot();
  const idempotencyKey = operationKey(input.postId, account.id, slot);
  const existing = await prisma.publishOperation.findUnique({ where: { idempotencyKey } });
  if (existing && !canOpenAnotherOperation(existing.status, existing.externalId)) return { row: existing, execute: false };
  await prisma.publishOperation.updateMany({
    where: {
      postId: input.postId,
      accountId: account.id,
      status: { in: ["SCHEDULED", "PENDING"] },
      NOT: { idempotencyKey },
    },
    data: { status: "CANCELLED", errorMessage: "Se reemplazó por otra operación de la misma cuenta." },
  });
  const data = {
    status,
    scheduledFor: input.scheduledFor,
    errorMessage: message,
    errorCode: status === "PUBLISHING" || status === "SCHEDULED" ? null : status,
    retryable: false,
    versionId: versionId ?? null,
    lockedAt: status === "PUBLISHING" ? new Date() : null,
    attemptedAt: status === "PUBLISHING" ? new Date() : null,
  };
  if (existing) {
    const row = await prisma.publishOperation.update({
      where: { id: existing.id },
      data: status === "PUBLISHING" ? { ...data, attemptCount: { increment: 1 } } : data,
    });
    return { row, execute: status === "PUBLISHING" };
  }
  try {
    const row = await prisma.publishOperation.create({
      data: {
        ...data,
        attemptCount: status === "PUBLISHING" ? 1 : 0,
        workspaceId: input.workspaceId,
        postId: input.postId,
        accountId: account.id,
        platformId: account.platformId,
        idempotencyKey,
        isDemo: input.post.isDemo,
      },
    });
    return { row, execute: status === "PUBLISHING" };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.publishOperation.findUnique({ where: { idempotencyKey } });
      if (raced) return { row: raced, execute: false };
    }
    throw error;
  }
}

export async function executeOperation(operationId: string) {
  const operation = await prisma.publishOperation.findUnique({
    where: { id: operationId },
    include: { account: true, post: { include: { versions: true } }, version: true },
  });
  if (!operation) return { status: "FAILED" as const, message: "No está la operación.", externalId: null };
  if (operation.externalId) {
    await prisma.publishOperation.update({ where: { id: operation.id }, data: { status: "PUBLISHED", retryable: false } });
    return { status: "PUBLISHED" as const, message: "La red ya tenía un identificador. No se envió de nuevo.", externalId: operation.externalId };
  }
  if (operation.status !== "PUBLISHING") {
    return { status: operation.status, message: operation.errorMessage || "", externalId: operation.externalId };
  }
  const version = operation.version ?? operation.post.versions.find((item) => item.platformId === operation.platformId);
  const content = {
    title: version?.title || operation.post.title,
    body: version?.body || operation.post.masterBody,
    linkUrl: version?.linkUrl || operation.post.linkUrl,
    hashtags: version?.hashtags || [],
  };
  let credentials: AccountCredentials = {};
  try {
    credentials = credentialsOf(operation.account);
  } catch {
    await prisma.publishOperation.update({
      where: { id: operation.id },
      data: { status: "NEEDS_AUTH", errorCode: "NEEDS_AUTH", errorMessage: "No se pudo leer la credencial cifrada.", retryable: false },
    });
    return { status: "NEEDS_AUTH" as const, message: "No se pudo leer la credencial cifrada.", externalId: null };
  }
  const media = await loadMedia(operation.postId);
  const outcome = await getAdapter(operation.platformId).publish({
    ...content,
    media,
    credentials,
    externalId: operation.account.externalId,
  });
  if (outcome.ok) {
    await prisma.publishOperation.update({
      where: { id: operation.id },
      data: {
        status: "PUBLISHED",
        externalId: outcome.externalId,
        externalUrl: outcome.externalUrl,
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        retryable: false,
        resultSource: "LOCAL",
      },
    });
    return { status: "PUBLISHED" as const, message: "Publicado correctamente.", externalId: outcome.externalId };
  }
  const status: OperationStatus =
    outcome.code === "NEEDS_AUTH" ? "NEEDS_AUTH" : outcome.code === "MANUAL_REQUIRED" ? "MANUAL_REQUIRED" : outcome.code === "NOT_COMPATIBLE" ? "NOT_COMPATIBLE" : "FAILED";
  await prisma.publishOperation.update({
    where: { id: operation.id },
    data: { status, errorCode: outcome.code, errorMessage: outcome.message, retryable: outcome.retryable, completedAt: new Date() },
  });
  return { status, message: outcome.message, externalId: null };
}

export async function refreshPostStatus(postId: string) {
  const operations = await prisma.publishOperation.findMany({ where: { postId } });
  if (operations.length === 0) return;
  const statuses = new Set(operations.map((item) => item.status));
  let status: "DRAFT" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "PARTIAL" | "FAILED" = "DRAFT";
  if (statuses.has("PUBLISHING")) status = "PUBLISHING";
  else if (operations.every((item) => item.status === "PUBLISHED")) status = "PUBLISHED";
  else if (operations.some((item) => item.status === "PUBLISHED")) status = "PARTIAL";
  else if (operations.every((item) => item.status === "SCHEDULED")) status = "SCHEDULED";
  else if (operations.some((item) => item.status === "FAILED" || item.status === "NEEDS_AUTH")) status = "FAILED";
  const upcoming = operations
    .map((item) => item.scheduledFor)
    .filter((date): date is Date => date instanceof Date)
    .sort((left, right) => left.getTime() - right.getTime())[0];
  await prisma.post.update({
    where: { id: postId },
    data: { status, ...(upcoming ? { plannedFor: upcoming } : {}) },
  });
}

export async function claimDueOperations(limit = 5) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH picked AS (
      SELECT id FROM "PublishOperation"
      WHERE status = 'SCHEDULED' AND "scheduledFor" <= NOW() AND "externalId" IS NULL
      ORDER BY "scheduledFor"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "PublishOperation" AS operation
    SET status = 'PUBLISHING', "lockedAt" = NOW(), "attemptedAt" = NOW(), "attemptCount" = operation."attemptCount" + 1
    FROM picked
    WHERE operation.id = picked.id
    RETURNING operation.id
  `;
  for (const row of rows) {
    await executeOperation(row.id);
    const operation = await prisma.publishOperation.findUnique({ where: { id: row.id } });
    if (operation) await refreshPostStatus(operation.postId);
  }
  return rows.length;
}
