export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INPROCESS_WORKER === "true") return;
  const { startPoller } = await import("@/worker/main");
  startPoller();
}
