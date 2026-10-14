import { json, requireRole } from "@/lib/http";
import { syncAccount } from "@/app/api/accounts/route";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("admin");
  if ("error" in auth && auth.error) return auth.error;
  const { id } = await context.params;
  try {
    const count = await syncAccount(id, auth.session.membership.workspaceId);
    return json({ synced: count });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "No se pudo sincronizar." }, 400);
  }
}
