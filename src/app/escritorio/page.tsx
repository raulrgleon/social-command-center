import { redirect } from "next/navigation";
import { Composer } from "@/components/composer";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { postInclude, presentPost } from "@/lib/posts/service";

export const metadata = { title: "Escritorio" };

export default async function EscritorioPage({ searchParams }: { searchParams: Promise<{ post?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { post } = await searchParams;
  const workspaceId = session.membership.workspaceId;
  const [accounts, record] = await Promise.all([
    prisma.connectedAccount.findMany({ where: { workspaceId }, orderBy: { displayName: "asc" } }),
    post ? prisma.post.findFirst({ where: { id: post, workspaceId }, include: postInclude }) : Promise.resolve(null),
  ]);
  return (
    <Composer
      timezone={session.user.timezone}
      initialPost={record ? presentPost(record) : null}
      accounts={accounts.map((account) => ({
        id: account.id,
        platformId: account.platformId,
        displayName: account.displayName,
        status: account.status,
        isDemo: account.isDemo,
        canPublish: account.canPublish,
        lastSyncAt: account.lastSyncAt?.toISOString() ?? null,
      }))}
    />
  );
}
