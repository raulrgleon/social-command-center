import { callUpstream } from "@/lib/adapters/types";
import { prisma } from "@/lib/db";
import { exchangeCode } from "@/lib/oauth/exchange";
import { getPlatform } from "@/lib/platforms/catalog";
import { encryptJson, sha256 } from "@/lib/security/crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform: platformId } = await context.params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const back = (message: string) => NextResponse.redirect(`${appUrl}/escritorio/cuentas?error=${encodeURIComponent(message)}`);
  if (!code || !state) return back("La red no devolvió el código de autorización.");
  const saved = await prisma.oauthState.findUnique({ where: { stateHash: sha256(state) } });
  if (!saved || saved.expiresAt < new Date() || saved.platformId !== platformId) return back("La autorización caducó. Vuelve a intentarlo.");
  await prisma.oauthState.delete({ where: { id: saved.id } });
  const platform = getPlatform(platformId);
  if (!platform) return back("Red desconocida.");
  try {
    const token = await exchangeCode(platformId, code, saved.codeVerifier);
    const targets = await destinations(platformId, token.accessToken, token.externalId);
    for (const target of targets) {
      const sealed = encryptJson({ accessToken: token.accessToken, refreshToken: token.refreshToken, externalId: target.externalId, subreddit: target.subreddit, boardId: target.boardId, blogIdentifier: target.blogIdentifier });
      await prisma.connectedAccount.create({
        data: {
          workspaceId: saved.workspaceId,
          platformId,
          displayName: target.name,
          handle: target.handle,
          externalId: target.externalId,
          status: "CONNECTED",
          canPublish: platform.publishSupported,
          canRead: platform.readSupported,
          canSchedule: platform.scheduleSupported,
          canMetrics: platform.metricsSupported,
          contentTypes: ["text"],
          tokenCipher: sealed.cipher,
          tokenIv: sealed.iv,
          tokenTag: sealed.tag,
          tokenExpiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null,
          scopes: platform.envKeys,
        },
      });
    }
  } catch (error) {
    return back(error instanceof Error ? error.message : "No se pudo completar la conexión.");
  }
  return NextResponse.redirect(`${appUrl}/escritorio/cuentas?conectada=${platformId}`);
}

async function destinations(platformId: string, accessToken: string, externalId?: string): Promise<Array<{ name: string; handle: string; externalId: string; subreddit?: string; boardId?: string; blogIdentifier?: string }>> {
  if (platformId === "facebook") {
    const result = await callUpstream(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`, { method: "GET" });
    if (!result.ok) throw new Error(result.message);
    const data = Array.isArray(result.json.data) ? result.json.data : [];
    if (data.length === 0) throw new Error("No hay Páginas de Facebook con permiso de publicación.");
    return data.map((item) => {
      const row = item as { id?: string; name?: string };
      return { name: String(row.name || "Página"), handle: "", externalId: String(row.id || "") };
    });
  }
  if (platformId === "instagram") {
    const result = await callUpstream(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`, { method: "GET" });
    if (!result.ok) throw new Error(result.message);
    const data = Array.isArray(result.json.data) ? result.json.data : [];
    const accounts = data
      .map((item) => item as { name?: string; instagram_business_account?: { id?: string } })
      .filter((item) => item.instagram_business_account?.id)
      .map((item) => ({ name: `${item.name} · Instagram`, handle: "", externalId: String(item.instagram_business_account?.id) }));
    if (accounts.length === 0) throw new Error("Ninguna Página tiene una cuenta profesional de Instagram.");
    return accounts;
  }
  if (platformId === "linkedin") {
    const result = await callUpstream("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!result.ok) throw new Error(result.message);
    return [{ name: String(result.json.name || "LinkedIn"), handle: "", externalId: `urn:li:person:${result.json.sub}` }];
  }
  if (platformId === "x") {
    const result = await callUpstream("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!result.ok) throw new Error(result.message);
    const data = result.json.data as { id?: string; username?: string; name?: string } | undefined;
    if (!data?.id) throw new Error("X no identificó al usuario.");
    return [{ name: data.name || data.username || "X", handle: data.username || "", externalId: data.id }];
  }
  return [{ name: getPlatform(platformId)?.name || platformId, handle: "", externalId: externalId || "" }];
}
