import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, limit } from "@/lib/http";
import { verifyPassword } from "@/lib/security/passwords";

const credentials = z.strictObject({ email: z.email(), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const blocked = limit(request, "login", 8, 15 * 60 * 1000);
  if (blocked) return blocked;
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Correo o contraseña incorrectos." }, 401);
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return json({ error: "Correo o contraseña incorrectos." }, 401);
  }
  await createSession(user.id, request.headers.get("user-agent") || "");
  await audit({ userId: user.id, action: "auth.login", entityType: "user", entityId: user.id });
  return json({ ok: true });
}
