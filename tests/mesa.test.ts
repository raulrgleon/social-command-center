import { describe, expect, it } from "vitest";
import { summarizeActivity } from "@/lib/posts/counters";
import { editVersion, syncMaster, versionFromMaster } from "@/lib/posts/versions";
import { canRetry, operationKey } from "@/lib/posts/idempotency";
import { validatePlatformContent } from "@/lib/platforms/validation";
import { getAdapter } from "@/lib/adapters/registry";
import { isBlockedAddress } from "@/lib/security/ssrf";
import { localAssist } from "@/lib/ai/local";
import { jaccard } from "@/lib/ai/similarity";

describe("contadores diarios", () => {
  it("cambia de día según la zona horaria y separa local de sincronizado", () => {
    const beforeMidnight = new Date("2026-10-15T04:30:00Z");
    const afterMidnight = new Date("2026-10-15T05:30:00Z");
    const operations = [
      { platformId: "facebook", status: "PUBLISHED" as const, completedAt: beforeMidnight, scheduledFor: null, resultSource: "LOCAL" as const, isDemo: false },
      { platformId: "facebook", status: "PUBLISHED" as const, completedAt: beforeMidnight, scheduledFor: null, resultSource: "LOCAL" as const, isDemo: true },
    ];
    const early = summarizeActivity(operations, [{ platformId: "facebook", publishedAt: beforeMidnight }], beforeMidnight, "America/Bogota");
    const late = summarizeActivity(operations, [], afterMidnight, "America/Bogota");
    expect(early.byPlatform.get("facebook")?.localPublished).toBe(1);
    expect(early.byPlatform.get("facebook")?.externalPublished).toBe(1);
    expect(late.totals.localPublished).toBe(0);
  });
});

describe("versiones", () => {
  it("no pisa una versión ya personalizada", () => {
    const master = { title: "A", body: "original", linkUrl: "", hashtags: [] };
    const versions = [
      versionFromMaster("facebook", master),
      { ...versionFromMaster("instagram", master), body: "propia", customized: true },
    ];
    const next = syncMaster(versions, { ...master, body: "nuevo maestro" });
    expect(next.find((item) => item.platformId === "facebook")?.body).toBe("nuevo maestro");
    expect(next.find((item) => item.platformId === "instagram")?.body).toBe("propia");
    const edited = editVersion(next, "instagram", { body: "otra" });
    expect(edited.find((item) => item.platformId === "facebook")?.body).toBe("nuevo maestro");
  });
});

describe("idempotencia", () => {
  it("no reintenta si ya hay referencia externa", () => {
    expect(canRetry({ status: "FAILED", externalId: "abc", retryable: true, attemptCount: 1 })).toBe(false);
    expect(canRetry({ status: "FAILED", externalId: null, retryable: true, attemptCount: 1 })).toBe(true);
    expect(operationKey("p", "a", "immediate")).toBe(operationKey("p", "a", "immediate"));
  });
});

describe("validación", () => {
  it("avisa cuando X se pasa de 280", () => {
    const issues = validatePlatformContent("x", { title: "", body: "a".repeat(281), linkUrl: "", hashtags: [], mediaKinds: [] });
    expect(issues.some((issue) => issue.code === "body_too_long")).toBe(true);
  });
});

describe("adaptadores", () => {
  const input = { title: "t", body: "hola", linkUrl: "", hashtags: [], media: [], credentials: {}, externalId: null };

  it("no marca éxito sin identificador", async () => {
    const result = await getAdapter("facebook").publish({
      ...input,
      credentials: { accessToken: "token" },
      externalId: "page",
      fetchImpl: async () => new Response(JSON.stringify({}), { status: 200 }),
    });
    expect(result.ok).toBe(false);
  });

  it("confirma solo con el id devuelto por la red", async () => {
    const result = await getAdapter("facebook").publish({
      ...input,
      credentials: { accessToken: "token" },
      externalId: "page",
      fetchImpl: async () => new Response(JSON.stringify({ id: "1_2" }), { status: 200 }),
    });
    expect(result).toMatchObject({ ok: true, externalId: "1_2" });
  });

  it("no llama a la red cuando la publicación es manual", async () => {
    let called = false;
    const result = await getAdapter("whatsapp").publish({
      ...input,
      fetchImpl: async () => { called = true; return new Response("{}", { status: 200 }); },
    });
    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MANUAL_REQUIRED");
  });
});

describe("seguridad de URLs", () => {
  it("bloquea direcciones internas", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });
});

describe("asistente local", () => {
  it("se identifica y no inventa horarios", () => {
    const result = localAssist({ task: "suggest_times", text: "", tone: "informativo", historyHours: [] });
    expect(result.provider).toBe("local");
    expect(result.notice.toLowerCase()).toContain("no inventa");
    expect(jaccard("mesa de redacción", "mesa de redacción")).toBe(1);
  });
});
