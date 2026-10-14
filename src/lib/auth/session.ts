import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security/crypto";

export const SESSION_COOKIE = "mesa_session";
export const WORKSPACE_COOKIE = "mesa_workspace";
const MAX_AGE = 60 * 60 * 24 * 14;

export async function createSession(userId: string, userAgent: string) {
  const token = randomToken();
  await prisma.authSession.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + MAX_AGE * 1000),
      userAgent: userAgent.slice(0, 200),
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.authSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(WORKSPACE_COOKIE);
}

export async function getSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { memberships: { include: { workspace: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.authSession.delete({ where: { id: session.id } });
    return null;
  }
  const preferred = jar.get(WORKSPACE_COOKIE)?.value;
  const membership = session.user.memberships.find((item) => item.workspaceId === preferred) ?? session.user.memberships[0];
  if (!membership) return null;
  return { sessionId: session.id, user: session.user, membership };
}

export async function setWorkspaceCookie(workspaceId: string) {
  const jar = await cookies();
  jar.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}
