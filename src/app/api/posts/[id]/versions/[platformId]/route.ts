import { z } from "zod";
import { assertSameOrigin, json, requireRole } from "@/lib/http";
import { updateVersion } from "@/lib/posts/service";

const schema = z.strictObject({
  title: z.string().max(300),
  body: z.string().max(50000),
  linkUrl: z.string().max(2000),
  hashtags: z.array(z.string().max(80)).max(40),
});

export async function PUT(request: Request, context: { params: Promise<{ id: string; platformId: string }> }) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "La versión no es válida." }, 400);
  const { id, platformId } = await context.params;
  const version = await updateVersion({ workspaceId: auth.session.membership.workspaceId, postId: id, platformId, ...parsed.data });
  if (!version) return json({ error: "No está la publicación." }, 404);
  return json({ version });
}
