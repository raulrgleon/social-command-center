import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertSameOrigin, json, limit } from "@/lib/http";

const schema = z.strictObject({
  name: z.string().min(2).max(80),
  email: z.email(),
  message: z.string().min(10).max(2000),
});

export async function POST(request: Request) {
  const blocked = limit(request, "contact", 5, 60 * 60 * 1000);
  if (blocked) return blocked;
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Revisa el nombre, el correo y el mensaje." }, 400);
  await prisma.contactMessage.create({ data: parsed.data });
  return json({ ok: true });
}
