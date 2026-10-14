import { json } from "@/lib/http";
import { PLATFORMS } from "@/lib/platforms/catalog";
import { missingEnv } from "@/lib/oauth/urls";

export async function GET() {
  return json({
    platforms: PLATFORMS.map((platform) => ({
      id: platform.id,
      name: platform.name,
      mode: platform.mode,
      publishSupported: platform.publishSupported,
      readSupported: platform.readSupported,
      metricsSupported: platform.metricsSupported,
      scheduleSupported: platform.scheduleSupported,
      auth: platform.auth,
      summary: platform.summary,
      manualSteps: platform.manualSteps,
      docsUrl: platform.docsUrl,
      bodyMax: platform.bodyMax,
      titleMax: platform.titleMax ?? null,
      hashtagMax: platform.hashtagMax ?? null,
      missingEnv: missingEnv(platform.id),
      ready: platform.auth === "token" || platform.auth === "none" || missingEnv(platform.id).length === 0,
    })),
  });
}
