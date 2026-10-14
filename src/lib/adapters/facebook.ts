import { callUpstream, composeText, needsAuth, type SocialAdapter } from "@/lib/adapters/types";

const VERSION = "v21.0";

export const facebook: SocialAdapter = {
  platformId: "facebook",
  async publish(input) {
    const token = input.credentials.accessToken;
    const pageId = input.externalId;
    if (!token || !pageId) return needsAuth("Falta el token de la Página o su identificador.");
    const fetchImpl = input.fetchImpl;
    const image = input.media.find((item) => item.kind === "IMAGE" && item.bytes);
    if (image?.bytes) {
      const body = new FormData();
      body.set("caption", composeText(input));
      body.set("access_token", token);
      body.set("published", "true");
      body.set("file", new Blob([Buffer.from(image.bytes)], { type: image.mimeType }), image.filename);
      const result = await callUpstream(`https://graph.facebook.com/${VERSION}/${pageId}/photos`, { method: "POST", body }, fetchImpl);
      if (!result.ok) return result;
      const id = String(result.json.post_id || result.json.id || "");
      if (!id) return { ok: false, code: "UPSTREAM", message: "Facebook no devolvió un identificador de publicación.", retryable: false };
      return { ok: true, externalId: id, externalUrl: `https://www.facebook.com/${id}` };
    }
    const params = new URLSearchParams({ message: composeText(input), access_token: token });
    if (input.linkUrl) params.set("link", input.linkUrl);
    const result = await callUpstream(`https://graph.facebook.com/${VERSION}/${pageId}/feed`, { method: "POST", body: params }, fetchImpl);
    if (!result.ok) return result;
    const id = String(result.json.id || "");
    if (!id) return { ok: false, code: "UPSTREAM", message: "Facebook no devolvió un identificador de publicación.", retryable: false };
    return { ok: true, externalId: id, externalUrl: `https://www.facebook.com/${id}` };
  },
  async listRecent(input) {
    if (!input.credentials.accessToken || !input.externalId) return needsAuth("La Página no está conectada.");
    const url = new URL(`https://graph.facebook.com/${VERSION}/${input.externalId}/posts`);
    url.searchParams.set("fields", "id,message,created_time,permalink_url");
    url.searchParams.set("access_token", input.credentials.accessToken);
    const result = await callUpstream(url.toString(), { method: "GET" }, input.fetchImpl);
    if (!result.ok) return result;
    const data = Array.isArray(result.json.data) ? result.json.data : [];
    return {
      ok: true,
      items: data.map((item) => {
        const row = item as Record<string, unknown>;
        return {
          externalId: String(row.id || ""),
          publishedAt: new Date(String(row.created_time || Date.now())),
          text: String(row.message || ""),
          permalink: String(row.permalink_url || ""),
        };
      }).filter((item) => item.externalId),
    };
  },
  async metrics(input) {
    if (!input.credentials.accessToken) return needsAuth("La Página no está conectada.");
    const url = new URL(`https://graph.facebook.com/${VERSION}/${input.targetId}/insights`);
    url.searchParams.set("metric", "post_impressions,post_engaged_users");
    url.searchParams.set("access_token", input.credentials.accessToken);
    const result = await callUpstream(url.toString(), { method: "GET" }, input.fetchImpl);
    if (!result.ok) {
      return { availability: "UNAVAILABLE", reach: null, impressions: null, interactions: null, note: result.message };
    }
    const data = Array.isArray(result.json.data) ? result.json.data : [];
    const valueOf = (name: string) => {
      const row = data.find((item) => (item as { name?: string }).name === name) as { values?: Array<{ value?: number }> } | undefined;
      const value = row?.values?.[0]?.value;
      return typeof value === "number" ? value : null;
    };
    return {
      availability: "AVAILABLE",
      reach: null,
      impressions: valueOf("post_impressions"),
      interactions: valueOf("post_engaged_users"),
      note: "Métricas devueltas por la Graph API. El alcance no viene en estas dos métricas.",
    };
  },
};
