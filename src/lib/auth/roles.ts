import type { MemberRole } from "@/generated/prisma/client";

const rank: Record<MemberRole, number> = {
  VIEWER: 0,
  APPROVER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function canWrite(role: MemberRole) {
  return rank[role] >= rank.EDITOR;
}

export function canApprove(role: MemberRole) {
  return role === "APPROVER" || rank[role] >= rank.ADMIN;
}

export function canAdmin(role: MemberRole) {
  return rank[role] >= rank.ADMIN;
}
