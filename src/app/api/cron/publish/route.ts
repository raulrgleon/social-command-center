import { json } from "@/lib/http";
import { claimDueOperations } from "@/lib/publish/service";

export async function POST(request: Request) {
  const secret = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || secret !== `Bearer ${process.env.CRON_SECRET}`) return json({ error: "No autorizado." }, 401);
  const count = await claimDueOperations();
  return json({ processed: count });
}
