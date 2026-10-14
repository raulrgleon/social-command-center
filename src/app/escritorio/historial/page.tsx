import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata = { title: "Historial" };

const labels: Record<string, string> = {
  PUBLISHED: "Publicado correctamente",
  SCHEDULED: "Programado",
  FAILED: "Error",
  NEEDS_AUTH: "Requiere autorización",
  MANUAL_REQUIRED: "Publicación manual",
  NOT_COMPATIBLE: "No compatible",
  PUBLISHING: "Enviando",
  CANCELLED: "Cancelado",
};

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  const operations = await prisma.publishOperation.findMany({
    where: { workspaceId: session.membership.workspaceId },
    include: { account: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return (
    <div className="p-4 lg:p-8">
      <h1 className="font-serif text-4xl">Historial</h1>
      <ul className="mt-6 divide-y divide-line">
        {operations.length === 0 ? <li className="py-6 text-muted">Todavía no hay operaciones.</li> : operations.map((operation) => (
          <li key={operation.id} className="grid gap-1 py-4 md:grid-cols-[1fr_auto]">
            <div>
              <Link href={`/escritorio?post=${operation.postId}`} className="font-medium">{operation.account.displayName}</Link>
              <p className="text-sm text-muted">{labels[operation.status] || operation.status}{operation.isDemo ? " · demostración" : ""}{operation.resultSource === "EXTERNAL_SYNC" ? " · sincronizada" : " · local"}</p>
              {operation.errorMessage ? <p className="text-sm">{operation.errorMessage}</p> : null}
              {operation.externalId ? <p className="text-xs text-muted">Referencia {operation.externalId}</p> : null}
            </div>
            <p className="text-sm text-muted">{operation.completedAt?.toLocaleString("es") || operation.scheduledFor?.toLocaleString("es") || operation.createdAt.toLocaleString("es")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
