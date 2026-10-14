import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole } from "@/lib/http";

const schema = z.strictObject({
  name: z.string().min(2).max(80),
  description: z.string().max(2000).default(""),
  brandId: z.string().nullable().optional(),
  brandName: z.string().max(80).optional(),
  voice: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "La campaña no es válida." }, 400);
  let brandId = parsed.data.brandId || null;
  if (parsed.data.brandName) {
    const brand = await prisma.brand.create({ data: { workspaceId: auth.session.membership.workspaceId, name: parsed.data.brandName, voice: parsed.data.voice || "" } });
    brandId = brand.id;
  }
  const campaign = await prisma.campaign.create({
    data: { workspaceId: auth.session.membership.workspaceId, name: parsed.data.name, description: parsed.data.description, brandId },
  });
  return json({ campaign }, 201);
}
