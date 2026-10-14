import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole, requireUser } from "@/lib/http";
import { encryptJson } from "@/lib/security/crypto";
import { assertPublicHttpUrl } from "@/lib/security/ssrf";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const config = await prisma.aiConfig.findUnique({ where: { workspaceId: auth.session.membership.workspaceId } });
  return json({
    timezone: auth.session.user.timezone,
    workspace: auth.session.membership.workspace.name,
    ai: { provider: config?.provider ?? "none", model: config?.model ?? "gpt-4o-mini", baseUrl: config?.baseUrl ?? "", hasKey: Boolean(config?.keyCipher) },
  });
}

const schema = z.strictObject({
  timezone: z.string().max(80).optional(),
  provider: z.enum(["none", "openai", "compatible"]).optional(),
  model: z.string().max(80).optional(),
  baseUrl: z.string().max(200).optional(),
  apiKey: z.string().max(300).optional(),
  clearKey: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("admin");
  if ("error" in auth && auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Los ajustes no son válidos." }, 400);
  if (parsed.data.timezone) {
    try {
      new Intl.DateTimeFormat("es", { timeZone: parsed.data.timezone }).format(new Date());
    } catch {
      return json({ error: "La zona horaria no es válida." }, 400);
    }
    await prisma.user.update({ where: { id: auth.session.user.id }, data: { timezone: parsed.data.timezone } });
  }
  if (parsed.data.baseUrl) await assertPublicHttpUrl(parsed.data.baseUrl);
  const current = await prisma.aiConfig.findUnique({ where: { workspaceId: auth.session.membership.workspaceId } });
  const sealed = parsed.data.apiKey ? encryptJson(parsed.data.apiKey) : null;
  await prisma.aiConfig.upsert({
    where: { workspaceId: auth.session.membership.workspaceId },
    create: {
      workspaceId: auth.session.membership.workspaceId,
      provider: parsed.data.provider || "none",
      model: parsed.data.model || "gpt-4o-mini",
      baseUrl: parsed.data.baseUrl || "",
      keyCipher: sealed?.cipher,
      keyIv: sealed?.iv,
      keyTag: sealed?.tag,
    },
    update: {
      provider: parsed.data.provider ?? current?.provider,
      model: parsed.data.model ?? current?.model,
      baseUrl: parsed.data.baseUrl ?? current?.baseUrl,
      ...(parsed.data.clearKey ? { keyCipher: null, keyIv: null, keyTag: null } : {}),
      ...(sealed ? { keyCipher: sealed.cipher, keyIv: sealed.iv, keyTag: sealed.tag } : {}),
    },
  });
  return json({ ok: true });
}
