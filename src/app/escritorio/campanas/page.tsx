import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CampaignForm } from "@/components/campaign-form";

export const metadata = { title: "Campañas" };

export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [campaigns, brands] = await Promise.all([
    prisma.campaign.findMany({ where: { workspaceId: session.membership.workspaceId }, include: { brand: true, posts: true }, orderBy: { createdAt: "desc" } }),
    prisma.brand.findMany({ where: { workspaceId: session.membership.workspaceId } }),
  ]);
  return (
    <div className="p-4 lg:p-8">
      <h1 className="font-serif text-4xl">Campañas y marcas</h1>
      <CampaignForm brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))} />
      <ul className="mt-6 space-y-3">
        {brands.map((brand) => <li key={brand.id} className="text-sm">Marca {brand.name}{brand.voice ? ` · voz: ${brand.voice}` : ""}</li>)}
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="rounded-2xl border border-line bg-panel p-4">
            <p className="font-medium">{campaign.name}</p>
            <p className="text-sm text-muted">{campaign.brand?.name || "Sin marca"} · {campaign.posts.length} publicaciones</p>
            <p className="mt-2 text-sm">{campaign.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
