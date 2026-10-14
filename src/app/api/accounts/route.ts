import { z } from "zod";
import { callUpstream } from "@/lib/adapters/types";
import { audit } from "@/lib/audit";
import { getAdapter } from "@/lib/adapters/registry";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole, requireUser } from "@/lib/http";
import { getPlatform } from "@/lib/platforms/catalog";
import { encryptJson, decryptJson } from "@/lib/security/crypto";
import type { AccountCredentials } from "@/lib/adapters/types";

function present(account: {
  id: string;
  platformId: string;
  displayName: string;
  handle: string;
  externalId: string | null;
  status: string;
  isDemo: boolean;
  canRead: boolean;
  canPublish: boolean;
  canSchedule: boolean;
  canMetrics: boolean;
  contentTypes: string[];
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  tokenExpiresAt: Date | null;
}) {
  return {
    ...account,
    lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
    tokenExpiresAt: account.tokenExpiresAt?.toISOString() ?? null,
  };
}

const schema = z.strictObject({
  platformId: z.string().max(40),
  displayName: z.string().min(1).max(80),
  botToken: z.string().max(200).optional(),
  chatId: z.string().max(80).optional(),
  webhookUrl: z.string().max(300).optional(),
  identifier: z.string().max(120).optional(),
  appPassword: z.string().max(120).optional(),
  instanceUrl: z.string().max(200).optional(),
  accessToken: z.string().max(500).optional(),
  externalId: z.string().max(120).optional(),
  boardId: z.string().max(80).optional(),
  subreddit: z.string().max(80).optional(),
  blogIdentifier: z.string().max(120).optional(),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const accounts = await prisma.connectedAccount.findMany({
    where: { workspaceId: auth.session.membership.workspaceId },
    orderBy: { displayName: "asc" },
  });
  return json({ accounts: accounts.map(present) });
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("admin");
  if ("error" in auth && auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const platformId = typeof body?.platformId === "string" ? body.platformId : "";
  const platform = getPlatform(platformId);
  if (!platform || platform.auth !== "token") return json({ error: "Esta red no se conecta con un token." }, 400);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return json({ error: "Revisa los datos de la cuenta." }, 400);
  const credentials: AccountCredentials = { ...parsed.data };
  try {
    await verifyToken(platformId, credentials);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "La red no aceptó la credencial." }, 400);
  }
  const sealed = encryptJson(credentials);
  const account = await prisma.connectedAccount.create({
    data: {
      workspaceId: auth.session.membership.workspaceId,
      platformId,
      displayName: parsed.data.displayName,
      handle: parsed.data.identifier || parsed.data.chatId || "",
      externalId: parsed.data.externalId || parsed.data.chatId || parsed.data.subreddit || null,
      status: "CONNECTED",
      canRead: platform.readSupported,
      canPublish: platform.publishSupported,
      canSchedule: platform.scheduleSupported,
      canMetrics: platform.metricsSupported,
      contentTypes: ["text", platform.allowsImage ? "image" : "", platform.allowsVideo ? "video" : ""].filter(Boolean),
      tokenCipher: sealed.cipher,
      tokenIv: sealed.iv,
      tokenTag: sealed.tag,
    },
  });
  await audit({ workspaceId: auth.session.membership.workspaceId, userId: auth.session.user.id, action: "account.connect", entityType: "account", entityId: account.id, metadata: { platformId } });
  return json({ account: present(account) }, 201);
}

async function verifyToken(platformId: string, credentials: AccountCredentials) {
  if (platformId === "telegram") {
    if (!credentials.botToken || !credentials.chatId) throw new Error("Hacen falta el token del bot y el chat.");
    const result = await callUpstream(`https://api.telegram.org/bot${credentials.botToken}/getMe`, { method: "GET" });
    if (!result.ok || !result.json.ok) throw new Error("Telegram no reconoció el bot.");
    return;
  }
  if (platformId === "discord") {
    const webhook = credentials.webhookUrl || "";
    const url = new URL(webhook);
    if (url.protocol !== "https:" || (url.hostname !== "discord.com" && url.hostname !== "discordapp.com")) throw new Error("El webhook no es oficial.");
    const result = await callUpstream(url.toString(), { method: "GET" });
    if (!result.ok) throw new Error("Discord no reconoció el webhook.");
    return;
  }
  if (platformId === "bluesky") {
    if (!credentials.identifier || !credentials.appPassword) throw new Error("Hacen falta el identificador y la contraseña de aplicación.");
    const result = await callUpstream("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: credentials.identifier, password: credentials.appPassword }),
    });
    if (!result.ok) throw new Error("Bluesky no abrió la sesión.");
    return;
  }
  if (platformId === "mastodon") {
    const instance = (credentials.instanceUrl || "").replace(/\/$/, "");
    if (!instance.startsWith("https://") || !credentials.accessToken) throw new Error("Indica la instancia https y el token.");
    const safe = await import("@/lib/security/ssrf").then((mod) => mod.assertPublicHttpUrl(instance));
    const result = await callUpstream(`${safe.origin}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${credentials.accessToken}` } });
    if (!result.ok) throw new Error("Mastodon no reconoció el token.");
    credentials.externalId = String(result.json.id || "");
    return;
  }
  throw new Error("Esa red no admite este formulario.");
}

export async function DELETE(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("admin");
  if ("error" in auth && auth.error) return auth.error;
  const id = new URL(request.url).searchParams.get("id") || "";
  const account = await prisma.connectedAccount.findFirst({ where: { id, workspaceId: auth.session.membership.workspaceId } });
  if (!account || account.isDemo) return json({ error: "No se puede desconectar esa cuenta." }, 404);
  await prisma.connectedAccount.update({ where: { id }, data: { status: "DISCONNECTED", tokenCipher: null, tokenIv: null, tokenTag: null, canPublish: false } });
  return json({ ok: true });
}

export async function syncAccount(accountId: string, workspaceId: string) {
  const account = await prisma.connectedAccount.findFirst({ where: { id: accountId, workspaceId } });
  if (!account || account.isDemo) throw new Error("La cuenta de demostración no se sincroniza.");
  const adapter = getAdapter(account.platformId);
  if (!adapter.listRecent || !account.tokenCipher || !account.tokenIv || !account.tokenTag) {
    throw new Error("Esta red no tiene lectura oficial configurada.");
  }
  const credentials = decryptJson<AccountCredentials>(account.tokenCipher, account.tokenIv, account.tokenTag);
  const listed = await adapter.listRecent({ credentials, externalId: account.externalId });
  if (!("items" in listed)) {
    if (!listed.ok) throw new Error(listed.message);
    throw new Error("La red no devolvió publicaciones.");
  }
  for (const item of listed.items) {
    await prisma.externalPost.upsert({
      where: { accountId_externalId: { accountId: account.id, externalId: item.externalId } },
      update: { text: item.text, permalink: item.permalink, publishedAt: item.publishedAt },
      create: { workspaceId, accountId: account.id, platformId: account.platformId, externalId: item.externalId, text: item.text, permalink: item.permalink, publishedAt: item.publishedAt },
    });
  }
  await prisma.connectedAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date(), lastSyncError: null } });
  return listed.items.length;
}
