import { z } from "zod";
import { runAi } from "@/lib/ai/run";
import { assertSameOrigin, json, limit, requireRole } from "@/lib/http";

const schema = z.strictObject({
  task: z.enum(["from_idea", "from_article", "rewrite", "headlines", "hashtags", "cta", "translate", "tone", "shorten", "expand", "adapt", "campaign", "suggest_times", "duplicates"]),
  text: z.string().max(20000).default(""),
  tone: z.string().max(40).default("informativo"),
  language: z.string().max(40).optional(),
  idea: z.string().max(4000).optional(),
  url: z.string().max(2000).optional(),
  cta: z.string().max(300).optional(),
  platformIds: z.array(z.string()).max(20).optional(),
});

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const blocked = limit(request, `ai:${auth.session.user.id}`, 30, 60 * 60 * 1000);
  if (blocked) return blocked;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "La petición de ayuda no es válida." }, 400);
  try {
    const result = await runAi({ workspaceId: auth.session.membership.workspaceId, ...parsed.data });
    return json({ result });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No se pudo preparar el texto." }, 400);
  }
}
