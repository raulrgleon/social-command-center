import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/security/passwords";
import { PLATFORMS } from "../src/lib/platforms/catalog";

const email = "demo@mesa.local";
const password = process.env.DEMO_PASSWORD || "mesa-demo-2026";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") {
    console.log("Semilla omitida. Define SEED_DEMO=true para crear la demostración.");
    return;
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Redacción demo", passwordHash, timezone: "America/Bogota" },
  });
  const workspace = await prisma.workspace.upsert({
    where: { slug: "redaccion-demo" },
    update: { isDemo: true },
    create: { name: "Redacción demo", slug: "redaccion-demo", isDemo: true },
  });
  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, workspaceId: workspace.id, role: "OWNER" },
  });
  for (const platform of PLATFORMS) {
    await prisma.workspacePlatformPref.upsert({
      where: { workspaceId_platformId: { workspaceId: workspace.id, platformId: platform.id } },
      update: { sortOrder: platform.sortOrder },
      create: { workspaceId: workspace.id, platformId: platform.id, sortOrder: platform.sortOrder, visible: true },
    });
    const existing = await prisma.connectedAccount.findFirst({ where: { workspaceId: workspace.id, platformId: platform.id, isDemo: true } });
    if (!existing) {
      await prisma.connectedAccount.create({
        data: {
          workspaceId: workspace.id,
          platformId: platform.id,
          displayName: `${platform.name} · demostración`,
          status: "DEMO",
          isDemo: true,
          canPublish: false,
          canRead: false,
          canSchedule: false,
          canMetrics: false,
          contentTypes: ["text"],
        },
      });
    }
  }
  const brand = await prisma.brand.upsert({
    where: { id: "brand-demo" },
    update: {},
    create: { id: "brand-demo", workspaceId: workspace.id, name: "Cuaderno demo", voice: "Clara, concreta, sin adjetivos vacíos." },
  });
  await prisma.campaign.upsert({
    where: { id: "campaign-demo" },
    update: {},
    create: { id: "campaign-demo", workspaceId: workspace.id, brandId: brand.id, name: "Semana de presentación", description: "Campaña de ejemplo. No corresponde a publicaciones reales." },
  });
  const existingPost = await prisma.post.findFirst({ where: { workspaceId: workspace.id, isDemo: true, title: "Pieza de demostración" } });
  if (!existingPost) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        authorId: user.id,
        brandId: brand.id,
        campaignId: "campaign-demo",
        title: "Pieza de demostración",
        masterBody: "Este texto es de demostración. No se ha publicado en ninguna red.",
        tone: "informativo",
        isDemo: true,
        plannedFor: tomorrow,
        status: "SCHEDULED",
        versions: {
          create: [
            { platformId: "facebook", title: "Pieza de demostración", body: "Versión de Facebook. Sigue siendo un ejemplo.", hashtags: ["mesa"], linkUrl: "" },
            { platformId: "instagram", title: "", body: "Versión propia de Instagram. Cambiarla no toca a Facebook.", hashtags: ["demostracion"], linkUrl: "", customized: true },
          ],
        },
      },
    });
    const facebook = await prisma.connectedAccount.findFirst({ where: { workspaceId: workspace.id, platformId: "facebook", isDemo: true } });
    if (facebook) {
      await prisma.publishOperation.create({
        data: {
          workspaceId: workspace.id,
          postId: post.id,
          accountId: facebook.id,
          platformId: "facebook",
          idempotencyKey: `demo-${post.id}`,
          status: "SCHEDULED",
          scheduledFor: tomorrow,
          isDemo: true,
          errorMessage: "Programación de demostración. No se enviará a Facebook.",
        },
      });
    }
  }
  console.log(`Demostración lista: ${email}`);
}

main().finally(() => prisma.$disconnect());
