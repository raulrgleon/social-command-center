import { prisma } from "@/lib/db";
import { json, requireUser } from "@/lib/http";
import { readBytes } from "@/lib/storage";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  const media = await prisma.mediaAsset.findFirst({ where: { id, workspaceId: auth.session.membership.workspaceId } });
  if (!media) return json({ error: "No está el archivo." }, 404);
  const bytes = await readBytes(media.storageKey);
  return new Response(bytes, {
    headers: {
      "content-type": media.mimeType,
      "content-disposition": `inline; filename="${media.filename.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
