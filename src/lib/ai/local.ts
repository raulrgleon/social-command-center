import { getPlatform } from "@/lib/platforms/catalog";
import { clipToLimit } from "@/lib/posts/versions";
import { suggestHashtags } from "@/lib/ai/similarity";

export type AiTask =
  | "from_idea"
  | "from_article"
  | "rewrite"
  | "headlines"
  | "hashtags"
  | "cta"
  | "translate"
  | "tone"
  | "shorten"
  | "expand"
  | "adapt"
  | "campaign"
  | "suggest_times"
  | "duplicates";

const CLOSINGS: Record<string, string> = {
  formal: "Quedamos atentos a sus comentarios.",
  informativo: "La información completa está en el enlace.",
  periodistico: "Seguiremos informando.",
  profesional: "Si quieres ampliar el tema, escríbenos.",
  cercano: "¿Qué te parece?",
  promocional: "Disponible ahora. Escríbenos para reservar.",
};

export type LocalAiInput = {
  task: AiTask;
  text: string;
  tone: string;
  language?: string;
  idea?: string;
  articleTitle?: string;
  articleText?: string;
  cta?: string;
  platformIds?: string[];
  historyHours?: number[];
};

export type LocalAiResult = {
  provider: "local" | "openai" | "compatible";
  notice: string;
  text: string;
  headlines: string[];
  hashtags: string[];
  versions: Array<{ platformId: string; title: string; body: string; hashtags: string[]; clipped: boolean }>;
  times: string[];
  duplicates: Array<{ id: string; score: number }>;
};

export function localAssist(input: LocalAiInput): LocalAiResult {
  const base = (input.articleText || input.text || input.idea || "").trim();
  const title = (input.articleTitle || "").trim();
  const tone = input.tone || "informativo";
  const closing = CLOSINGS[tone] ?? CLOSINGS.informativo;
  const notice =
    "Asistente local sin modelo externo. Reordena y recorta el texto; no inventa datos ni traduce con un modelo generativo.";

  const result: LocalAiResult = {
    provider: "local",
    notice,
    text: base,
    headlines: [],
    hashtags: suggestHashtags(`${title} ${base}`),
    versions: [],
    times: [],
    duplicates: [],
  };

  if (input.task === "translate") {
    result.text = base;
    result.notice = "La traducción necesita un modelo configurado en Ajustes. El texto original se mantiene.";
    return result;
  }

  if (input.task === "suggest_times") {
    const hours = input.historyHours ?? [];
    if (hours.length < 3) {
      result.notice = "No hay suficientes publicaciones reales para sugerir un horario. Mesa no inventa horas óptimas.";
      return result;
    }
    const tally = new Map<number, number>();
    for (const hour of hours) tally.set(hour, (tally.get(hour) ?? 0) + 1);
    result.times = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => `${String(hour).padStart(2, "0")}:00 · ${count} publicaciones reales`);
    result.text = result.times.join("\n");
    result.notice = "Horarios calculados solo con publicaciones reales de esta cuenta.";
    return result;
  }

  if (input.task === "hashtags") {
    result.text = result.hashtags.map((tag) => `#${tag}`).join(" ");
    return result;
  }

  if (input.task === "headlines") {
    const source = title || base.split(/[.\n]/)[0] || "Sin título";
    result.headlines = [source.trim(), `${source.trim()}`.slice(0, 70)].filter(Boolean);
    result.text = result.headlines.join("\n");
    return result;
  }

  if (input.task === "shorten") {
    const sentences = base.split(/(?<=[.!?])\s+/).filter(Boolean);
    result.text = (sentences.slice(0, 2).join(" ") || base).trim();
    return result;
  }

  if (input.task === "expand") {
    result.text = [base, "", "Ángulos que puedes desarrollar con datos propios:", "— qué pasó", "— a quién afecta", "— qué sigue"].join("\n");
    result.notice = "El asistente local no añade hechos. Solo deja un esquema para completar.";
    return result;
  }

  if (input.task === "cta") {
    const cta = input.cta?.trim() || closing;
    result.text = `${base}\n\n${cta}`.trim();
    return result;
  }

  if (input.task === "from_idea" || input.task === "from_article" || input.task === "rewrite" || input.task === "tone") {
    const lead = title ? `${title}. ` : "";
    const body = base || input.idea || "";
    result.text = `${lead}${body}`.trim();
    if (input.task !== "rewrite" && closing && !result.text.endsWith(closing)) {
      result.text = `${result.text}\n\n${closing}`.trim();
    }
    return result;
  }

  if (input.task === "adapt" || input.task === "campaign") {
    const ids = input.platformIds ?? [];
    result.versions = ids.map((platformId) => {
      const platform = getPlatform(platformId);
      const limit = platform?.bodyMax ?? 500;
      const titleLimit = platform?.titleMax ?? 100;
      const clippedBody = clipToLimit(base, limit);
      const clippedTitle = clipToLimit(title || base.split("\n")[0] || "", titleLimit);
      return {
        platformId,
        title: clippedTitle.text,
        body: clippedBody.text,
        hashtags: result.hashtags.slice(0, platform?.hashtagMax ?? 8),
        clipped: clippedBody.clipped || clippedTitle.clipped,
      };
    });
    result.text = result.versions.map((version) => `${version.platformId}: ${version.body}`).join("\n\n");
    return result;
  }

  return result;
}
