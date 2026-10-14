import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole } from "@/lib/http";
import { inspectUpload, saveBytes } from "@/lib/storage";
import { readBytes } from "@/lib/storage";

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Falta el archivo." }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const inspected = inspectUpload(file.type, bytes);
  if ("error" in inspected) return json({ error: inspected.error }, 400);
  const stored = await saveBytes(auth.session.membership.workspaceId, file.name, file.type, bytes);
  const media = await prisma.mediaAsset.create({
    data: {
      workspaceId: auth.session.membership.workspaceId,
      kind: inspected.kind,
      filename: file.name.slice(0, 120),
      mimeType: file.type,
      sizeBytes: bytes.byteLength,
      storageKey: stored.key,
    },
  });
  return json({ media: { id: media.id, kind: media.kind, filename: media.filename, mimeType: media.mimeType, sizeBytes: media.sizeBytes } }, 201);
}

export async function GET() {
  return json({ error: "Usa la ruta de cada archivo." }, 404);
}

export { readBytes };
