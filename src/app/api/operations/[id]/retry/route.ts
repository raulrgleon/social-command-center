import { prisma } from "@/lib/db";
import { assertSameOrigin, json, requireRole } from "@/lib/http";
import { canRetry } from "@/lib/posts/idempotency";
import { executeOperation, refreshPostStatus } from "@/lib/publish/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const auth = await requireRole("write");
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  const operation = await prisma.publishOperation.findFirst({ where: { id, workspaceId: auth.session.membership.workspaceId } });
  if (!operation) return json({ error: "No está la operación." }, 404);
  if (!canRetry(operation)) return json({ error: "Reintentar podría duplicar la publicación. Revisa la red antes." }, 409);
  await prisma.publishOperation.update({
    where: { id },
    data: { status: "PUBLISHING", lockedAt: new Date(), attemptedAt: new Date(), attemptCount: { increment: 1 }, errorMessage: null },
  });
  const result = await executeOperation(id);
  await refreshPostStatus(operation.postId);
  return json({ result });
}
