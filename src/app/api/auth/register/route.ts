import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, limit } from "@/lib/http";
import { hashPassword, passwordIssue } from "@/lib/security/passwords";
import { PLATFORMS } from "@/lib/platforms/catalog";
import { randomBytes } from "node:crypto";

const credentials = z.strictObject({
  email: z.email(),
  password: z.string().min(1).max(200),
  name: z.string().min(2).max(80).optional(),
});

function slugify(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "mesa";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function POST(request: Request) {
  const blocked = limit(request, "register", 5, 60 * 60 * 1000);
  if (blocked) return blocked;
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const parsed = credentials.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.name) return json({ error: "Revisa el nombre, el correo y la contraseña." }, 400);
  const issue = passwordIssue(parsed.data.password);
  if (issue) return json({ error: issue }, 400);
  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return json({ error: "Ese correo ya tiene una cuenta." }, 409);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      passwordHash: await hashPassword(parsed.data.password),
      memberships: {
        create: {
          role: "OWNER",
          workspace: {
            create: {
              name: `Mesa de ${parsed.data.name.trim()}`,
              slug: slugify(parsed.data.name),
              prefs: { create: PLATFORMS.map((platform) => ({ platformId: platform.id, sortOrder: platform.sortOrder, visible: true })) },
            },
          },
        },
      },
    },
    include: { memberships: true },
  });
  await createSession(user.id, request.headers.get("user-agent") || "");
  await audit({ userId: user.id, workspaceId: user.memberships[0]?.workspaceId, action: "auth.register", entityType: "user", entityId: user.id });
  return json({ ok: true });
}
