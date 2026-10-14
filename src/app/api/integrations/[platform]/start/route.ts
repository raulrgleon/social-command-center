import { prisma } from "@/lib/db";
import { json, requireRole } from "@/lib/http";
import { authorizationUrl, createVerifier, missingEnv } from "@/lib/oauth/urls";
import { getPlatform } from "@/lib/platforms/catalog";
import { randomToken, sha256 } from "@/lib/security/crypto";

export async function GET(_request: Request, context: { params: Promise<{ platform: string }> }) {
  const auth = await requireRole("admin");
  if ("error" in auth && auth.error) return auth.error;
  const { platform: platformId } = await context.params;
  const platform = getPlatform(platformId);
  if (!platform || platform.auth !== "oauth") return json({ error: "Esta red no usa OAuth en Mesa." }, 400);
  const missing = missingEnv(platformId);
  if (missing.length > 0) return json({ error: "Faltan credenciales de la aplicación en el servidor.", missing }, 409);
  const state = randomToken();
  const verifier = createVerifier();
  await prisma.oauthState.create({
    data: {
      workspaceId: auth.session.membership.workspaceId,
      platformId,
      stateHash: sha256(state),
      codeVerifier: verifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const url = authorizationUrl(platformId, state, verifier);
  if (!url) return json({ error: "El flujo oficial de esta red todavía no está preparado." }, 409);
  return json({ url });
}
