import { localAssist, type AiTask, type LocalAiResult } from "@/lib/ai/local";
import { findDuplicates } from "@/lib/ai/similarity";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/security/crypto";
import { assertPublicHttpUrl } from "@/lib/security/ssrf";

async function modelConfig(workspaceId: string) {
  const row = await prisma.aiConfig.findUnique({ where: { workspaceId } });
  let key = process.env.OPENAI_API_KEY || "";
  let baseUrl = "https://api.openai.com/v1";
  let model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  let provider: "openai" | "compatible" | "local" = key ? "openai" : "local";
  if (row?.provider === "openai" || row?.provider === "compatible") {
    provider = row.provider;
    model = row.model || model;
    if (row.baseUrl) baseUrl = row.baseUrl;
    if (row.keyCipher && row.keyIv && row.keyTag) key = decryptJson<string>(row.keyCipher, row.keyIv, row.keyTag);
  }
  if (!key) provider = "local";
  return { provider, key, baseUrl, model };
}

export async function runAi(input: {
  workspaceId: string;
  task: AiTask;
  text: string;
  tone: string;
  language?: string;
  idea?: string;
  url?: string;
  cta?: string;
  platformIds?: string[];
}) {
  let articleTitle = "";
  let articleText = "";
  if (input.url) {
    const target = await assertPublicHttpUrl(input.url);
    if (target.protocol !== "https:") throw new Error("Para leer un artículo hace falta https.");
    const response = await fetch(target, { signal: AbortSignal.timeout(8000), redirect: "manual" });
    if (response.status >= 300 && response.status < 400) throw new Error("La página redirige y no se siguió la redirección.");
    const html = (await response.text()).slice(0, 200_000);
    articleTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
    articleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  }
  const config = await modelConfig(input.workspaceId);
  if (input.task === "duplicates") {
    const posts = await prisma.post.findMany({ where: { workspaceId: input.workspaceId }, select: { id: true, title: true, masterBody: true }, take: 100 });
    const duplicates = findDuplicates(input.text, posts.map((post) => ({ id: post.id, text: `${post.title} ${post.masterBody}` })));
    return { provider: "local" as const, notice: "Comparación local por solapamiento de palabras. No es un modelo semántico.", text: "", headlines: [], hashtags: [], versions: [], times: [], duplicates };
  }
  if (input.task === "suggest_times") {
    const published = await prisma.publishOperation.findMany({
      where: { workspaceId: input.workspaceId, status: "PUBLISHED", isDemo: false, resultSource: "LOCAL", completedAt: { not: null } },
      select: { completedAt: true },
      take: 200,
    });
    const hours = published.map((item) => item.completedAt?.getUTCHours() ?? 0);
    return localAssist({ task: "suggest_times", text: input.text, tone: input.tone, historyHours: hours });
  }
  if (config.provider === "local") {
    return localAssist({ ...input, task: input.url ? "from_article" : input.task, articleTitle, articleText });
  }
  const target = await assertPublicHttpUrl(config.baseUrl.endsWith("/v1") ? `${config.baseUrl}/chat/completions` : `${config.baseUrl.replace(/\/$/, "")}/v1/chat/completions`);
  const response = await fetch(target, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Eres un editor de redes. No inventes cifras, citas ni hechos que no estén en el material. No publiques nada. Responde solo JSON con text, headlines, hashtags y versions.",
        },
        {
          role: "user",
          content: JSON.stringify({ task: input.task, tone: input.tone, language: input.language, idea: input.idea, text: input.text, articleTitle, articleText, cta: input.cta, platformIds: input.platformIds }),
        },
      ],
    }),
  });
  if (!response.ok) {
    const local = localAssist({ ...input, articleTitle, articleText });
    local.notice = "El modelo no respondió. Se usó el asistente local y queda identificado como tal.";
    return local;
  }
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content || "{}";
  let parsed: Partial<LocalAiResult>;
  try {
    parsed = JSON.parse(content) as Partial<LocalAiResult>;
  } catch {
    const local = localAssist({ ...input, articleTitle, articleText });
    local.notice = "El modelo respondió sin JSON utilizable. Se usó el asistente local y queda identificado como tal.";
    return local;
  }
  return {
    provider: config.provider,
    notice: "Texto generado por el modelo configurado. Revísalo antes de publicar.",
    text: String(parsed.text || ""),
    headlines: Array.isArray(parsed.headlines) ? parsed.headlines.map(String) : [],
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
    versions: Array.isArray(parsed.versions) ? parsed.versions : [],
    times: [],
    duplicates: [],
  };
}
