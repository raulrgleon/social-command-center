import { audit } from "@/lib/audit";
import { destroySession, getSession } from "@/lib/auth/session";
import { assertSameOrigin, json } from "@/lib/http";

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const session = await getSession();
  await destroySession();
  if (session) await audit({ userId: session.user.id, workspaceId: session.membership.workspaceId, action: "auth.logout", entityType: "user", entityId: session.user.id });
  return json({ ok: true });
}
