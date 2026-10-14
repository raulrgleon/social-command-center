import { claimDueOperations } from "@/lib/publish/service";

let started = false;

export function startPoller() {
  if (started) return;
  started = true;
  const tick = () => {
    claimDueOperations().catch((error) => {
      console.error("worker", error instanceof Error ? error.message : "error");
    });
  };
  setInterval(tick, 15_000);
  if (process.env.REDIS_URL) {
    void import("bullmq").then(async ({ Worker }) => {
      const worker = new Worker("mesa-publish", async () => claimDueOperations(), {
        connection: { url: process.env.REDIS_URL },
      });
      worker.on("failed", (job, error) => console.error("cola", job?.id, error.message));
    });
  }
}

const isMain = process.argv[1]?.includes("worker/main");
if (isMain) {
  startPoller();
  console.log("Worker de Mesa en marcha.");
}
