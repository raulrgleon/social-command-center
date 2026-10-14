import { getSession } from "@/lib/auth/session";
import { canAdmin, canApprove, canWrite } from "@/lib/auth/roles";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import type { MemberRole } from "@/generated/prisma/client";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return json({ error: "Origen no permitido." }, 403);
  try {
    if (new URL(origin).host !== host) return json({ error: "Origen no permitido." }, 403);
  } catch {
    return json({ error: "Origen no permitido." }, 403);
  }
  return null;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) return { error: json({ error: "Necesitas entrar." }, 401) } as const;
  return { session } as const;
}

export async function requireRole(kind: "write" | "approve" | "admin") {
  const result = await requireUser();
  if ("error" in result && result.error) return result;
  const role = result.session.membership.role as MemberRole;
  const allowed = kind === "write" ? canWrite(role) : kind === "approve" ? canApprove(role) : canAdmin(role);
  if (!allowed) return { error: json({ error: "No tienes permiso para esta acción." }, 403) } as const;
  return result;
}

export function limit(request: Request, bucket: string, max: number, windowMs: number) {
  const hit = rateLimit(`${bucket}:${clientIp(request)}`, max, windowMs);
  if (!hit) return null;
  return json({ error: "Demasiados intentos. Espera un momento.", retryAfter: hit.retryAfter }, 429);
}
