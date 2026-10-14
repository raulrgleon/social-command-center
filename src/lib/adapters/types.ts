export type MediaPayload = {
  filename: string;
  mimeType: string;
  kind: "IMAGE" | "VIDEO" | "DOCUMENT";
  bytes?: Uint8Array;
  publicUrl?: string;
};

export type AccountCredentials = {
  accessToken?: string;
  refreshToken?: string;
  botToken?: string;
  chatId?: string;
  webhookUrl?: string;
  identifier?: string;
  appPassword?: string;
  instanceUrl?: string;
  boardId?: string;
  subreddit?: string;
  blogIdentifier?: string;
  externalId?: string;
};

export type PublishInput = {
  title: string;
  body: string;
  linkUrl: string;
  hashtags: string[];
  media: MediaPayload[];
  credentials: AccountCredentials;
  externalId: string | null;
  fetchImpl?: typeof fetch;
};

export type PublishOutcome =
  | { ok: true; externalId: string; externalUrl?: string }
  | { ok: false; code: "NOT_CONFIGURED" | "MANUAL_REQUIRED" | "NOT_COMPATIBLE" | "NEEDS_AUTH" | "REJECTED" | "UPSTREAM" | "UNCERTAIN"; message: string; retryable: boolean };

export type ExternalItem = {
  externalId: string;
  publishedAt: Date;
  text: string;
  permalink: string;
};

export type MetricValues = {
  availability: "AVAILABLE" | "UNAVAILABLE" | "PENDING_SYNC";
  reach: number | null;
  impressions: number | null;
  interactions: number | null;
  note: string;
};

export type SocialAdapter = {
  platformId: string;
  publish: (input: PublishInput) => Promise<PublishOutcome>;
  listRecent?: (input: { credentials: AccountCredentials; externalId: string | null; fetchImpl?: typeof fetch }) => Promise<{ ok: true; items: ExternalItem[] } | PublishOutcome>;
  metrics?: (input: { credentials: AccountCredentials; externalId: string | null; targetId: string; fetchImpl?: typeof fetch }) => Promise<MetricValues | PublishOutcome>;
};

export function composeText(input: Pick<PublishInput, "body" | "hashtags" | "linkUrl">) {
  const tags = input.hashtags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  const missing = tags.filter((tag) => !input.body.includes(tag));
  return [input.body.trim(), missing.join(" "), input.linkUrl.trim()].filter(Boolean).join("\n\n");
}

export async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

export async function callUpstream(url: string, init: RequestInit, fetchImpl: typeof fetch = fetch): Promise<
  | { ok: true; status: number; json: Record<string, unknown>; headers: Headers }
  | { ok: false; code: "UPSTREAM" | "UNCERTAIN"; message: string; retryable: boolean }
> {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(20000) });
    const json = await readJson(response);
    if (!response.ok) {
      const message = String(json.error_message || json.error || json.message || json.detail || response.statusText || "La red rechazó la publicación.");
      const retryable = response.status === 429 || response.status >= 500;
      return { ok: false, code: "UPSTREAM", message: message.slice(0, 400), retryable };
    }
    return { ok: true, status: response.status, json, headers: response.headers };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, code: "UNCERTAIN", message: "La red no respondió a tiempo. No se reintentará solo para evitar un duplicado.", retryable: false };
    }
    return { ok: false, code: "UPSTREAM", message: "No se pudo contactar la red.", retryable: true };
  }
}

export function needsAuth(message: string): PublishOutcome {
  return { ok: false, code: "NEEDS_AUTH", message, retryable: false };
}

export function notCompatible(message: string): PublishOutcome {
  return { ok: false, code: "NOT_COMPATIBLE", message, retryable: false };
}

export function manual(message: string): PublishOutcome {
  return { ok: false, code: "MANUAL_REQUIRED", message, retryable: false };
}
