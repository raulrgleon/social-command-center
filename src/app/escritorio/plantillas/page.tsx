import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata = { title: "Plantillas" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  const templates = await prisma.template.findMany({ where: { workspaceId: session.membership.workspaceId }, orderBy: { updatedAt: "desc" } });
  return (
    <div className="p-4 lg:p-8">
      <h1 className="font-serif text-4xl">Plantillas</h1>
      <ul className="mt-6 space-y-3">
        {templates.length === 0 ? <li className="text-muted">Guarda una plantilla desde el escritorio.</li> : templates.map((template) => (
          <li key={template.id} className="rounded-2xl border border-line bg-panel p-4">
            <p className="font-medium">{template.name}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{template.masterBody.slice(0, 280)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
