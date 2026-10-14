import { callUpstream, composeText, needsAuth, notCompatible, type SocialAdapter } from "@/lib/adapters/types";

const VERSION = "v21.0";

export const instagram: SocialAdapter = {
  platformId: "instagram",
  async publish(input) {
    const token = input.credentials.accessToken;
    const igId = input.externalId;
    if (!token || !igId) return needsAuth("Falta la cuenta profesional de Instagram o su token.");
    const image = input.media.find((item) => item.kind === "IMAGE" && item.publicUrl);
    const video = input.media.find((item) => item.kind === "VIDEO" && item.publicUrl);
    if (!image && !video) {
      return notCompatible("Instagram exige una URL pública de la imagen o del video. Configura S3 o publícalo a mano.");
    }
    const params = new URLSearchParams({ caption: composeText(input), access_token: token });
    if (image?.publicUrl) params.set("image_url", image.publicUrl);
    if (!image && video?.publicUrl) {
      params.set("media_type", "REELS");
      params.set("video_url", video.publicUrl);
    }
    const created = await callUpstream(`https://graph.facebook.com/${VERSION}/${igId}/media`, { method: "POST", body: params }, input.fetchImpl);
    if (!created.ok) return created;
    const creationId = String(created.json.id || "");
    if (!creationId) return { ok: false, code: "UPSTREAM", message: "Instagram no devolvió el contenedor.", retryable: false };
    const published = await callUpstream(
      `https://graph.facebook.com/${VERSION}/${igId}/media_publish`,
      { method: "POST", body: new URLSearchParams({ creation_id: creationId, access_token: token }) },
      input.fetchImpl,
    );
    if (!published.ok) return { ...published, retryable: false };
    const id = String(published.json.id || "");
    if (!id) return { ok: false, code: "UNCERTAIN", message: "El contenedor se creó, pero Instagram no confirmó la publicación.", retryable: false };
    return { ok: true, externalId: id };
  },
};

export const threads: SocialAdapter = {
  platformId: "threads",
  async publish(input) {
    const token = input.credentials.accessToken;
    const userId = input.externalId;
    if (!token || !userId) return needsAuth("Falta la cuenta de Threads o su token.");
    const params = new URLSearchParams({
      media_type: "TEXT",
      text: composeText(input).slice(0, 500),
      access_token: token,
    });
    const image = input.media.find((item) => item.kind === "IMAGE" && item.publicUrl);
    if (image?.publicUrl) {
      params.set("media_type", "IMAGE");
      params.set("image_url", image.publicUrl);
    }
    const created = await callUpstream(`https://graph.threads.net/v1.0/${userId}/threads`, { method: "POST", body: params }, input.fetchImpl);
    if (!created.ok) return created;
    const creationId = String(created.json.id || "");
    if (!creationId) return { ok: false, code: "UPSTREAM", message: "Threads no devolvió el contenedor.", retryable: false };
    const published = await callUpstream(
      `https://graph.threads.net/v1.0/${userId}/threads_publish`,
      { method: "POST", body: new URLSearchParams({ creation_id: creationId, access_token: token }) },
      input.fetchImpl,
    );
    if (!published.ok) return { ...published, retryable: false };
    const id = String(published.json.id || "");
    if (!id) return { ok: false, code: "UNCERTAIN", message: "Threads no confirmó la publicación.", retryable: false };
    return { ok: true, externalId: id };
  },
};
