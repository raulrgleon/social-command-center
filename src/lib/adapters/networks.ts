import { callUpstream, composeText, needsAuth, notCompatible, type SocialAdapter } from "@/lib/adapters/types";

export const linkedin: SocialAdapter = {
  platformId: "linkedin",
  async publish(input) {
    const token = input.credentials.accessToken;
    const author = input.externalId;
    if (!token || !author) return needsAuth("Falta el token de LinkedIn o el URN del autor.");
    const response = await callUpstream(
      "https://api.linkedin.com/rest/posts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202601",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author,
          commentary: composeText(input),
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const id = String(response.json.id || response.json.xRestliId || "");
    if (!id) return { ok: false, code: "UNCERTAIN", message: "LinkedIn no devolvió el identificador del post.", retryable: false };
    return { ok: true, externalId: id };
  },
};

export const x: SocialAdapter = {
  platformId: "x",
  async publish(input) {
    const token = input.credentials.accessToken;
    if (!token) return needsAuth("Falta el token de X.");
    const text = composeText(input);
    if (text.length > 280) return notCompatible("X rechazará el texto porque supera 280 caracteres.");
    const response = await callUpstream(
      "https://api.x.com/2/tweets",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const data = response.json.data as { id?: string } | undefined;
    const id = String(data?.id || "");
    if (!id) return { ok: false, code: "UPSTREAM", message: "X no devolvió el identificador del post.", retryable: false };
    return { ok: true, externalId: id, externalUrl: `https://x.com/i/web/status/${id}` };
  },
  async listRecent(input) {
    if (!input.credentials.accessToken || !input.externalId) return needsAuth("La cuenta de X no está conectada.");
    const url = new URL(`https://api.x.com/2/users/${input.externalId}/tweets`);
    url.searchParams.set("max_results", "10");
    url.searchParams.set("tweet.fields", "created_at,text,public_metrics");
    const response = await callUpstream(url.toString(), { headers: { Authorization: `Bearer ${input.credentials.accessToken}` } }, input.fetchImpl);
    if (!response.ok) return response;
    const data = Array.isArray(response.json.data) ? response.json.data : [];
    return {
      ok: true,
      items: data.map((item) => {
        const row = item as { id?: string; text?: string; created_at?: string };
        return {
          externalId: String(row.id || ""),
          text: String(row.text || ""),
          publishedAt: new Date(row.created_at || Date.now()),
          permalink: row.id ? `https://x.com/i/web/status/${row.id}` : "",
        };
      }).filter((item) => item.externalId),
    };
  },
};

export const youtube: SocialAdapter = {
  platformId: "youtube",
  async publish(input) {
    const token = input.credentials.accessToken;
    const video = input.media.find((item) => item.kind === "VIDEO" && item.bytes);
    if (!token) return needsAuth("Falta el token de YouTube.");
    if (!video?.bytes) return notCompatible("YouTube solo publica videos por API. Las entradas de Comunidad no están disponibles.");
    const start = await callUpstream(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": video.mimeType,
          "X-Upload-Content-Length": String(video.bytes.byteLength),
        },
        body: JSON.stringify({
          snippet: { title: input.title.slice(0, 100) || "Video", description: composeText(input).slice(0, 5000) },
          status: { privacyStatus: "public" },
        }),
      },
      input.fetchImpl,
    );
    if (!start.ok) return start;
    const location = start.headers.get("location") || "";
    if (!location) return { ok: false, code: "UNCERTAIN", message: "YouTube no entregó la URL de subida.", retryable: false };
    const uploaded = await callUpstream(location, { method: "PUT", headers: { "Content-Type": video.mimeType }, body: Buffer.from(video.bytes) }, input.fetchImpl);
    if (!uploaded.ok) return uploaded;
    const id = String(uploaded.json.id || "");
    if (!id) return { ok: false, code: "UNCERTAIN", message: "La subida terminó sin identificador de video.", retryable: false };
    return { ok: true, externalId: id, externalUrl: `https://www.youtube.com/watch?v=${id}` };
  },
};

export const pinterest: SocialAdapter = {
  platformId: "pinterest",
  async publish(input) {
    const token = input.credentials.accessToken;
    const boardId = input.credentials.boardId || input.externalId;
    const image = input.media.find((item) => item.kind === "IMAGE" && item.publicUrl);
    if (!token || !boardId) return needsAuth("Falta el token de Pinterest o el tablero.");
    if (!image?.publicUrl) return notCompatible("Pinterest necesita una imagen con URL pública.");
    const response = await callUpstream(
      "https://api.pinterest.com/v5/pins",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: boardId,
          title: input.title.slice(0, 100),
          description: composeText(input).slice(0, 800),
          link: input.linkUrl || undefined,
          media_source: { source_type: "image_url", url: image.publicUrl },
        }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const id = String(response.json.id || "");
    if (!id) return { ok: false, code: "UPSTREAM", message: "Pinterest no devolvió el pin.", retryable: false };
    return { ok: true, externalId: id };
  },
};

export const reddit: SocialAdapter = {
  platformId: "reddit",
  async publish(input) {
    const token = input.credentials.accessToken;
    const subreddit = (input.credentials.subreddit || input.externalId || "").replace(/^r\//, "");
    if (!token || !subreddit) return needsAuth("Falta el token de Reddit o el subreddit.");
    const kind = input.linkUrl ? "link" : "self";
    const body = new URLSearchParams({
      sr: subreddit,
      kind,
      title: input.title.slice(0, 300) || composeText(input).slice(0, 300),
      resubmit: "true",
      api_type: "json",
    });
    if (kind === "link") body.set("url", input.linkUrl);
    else body.set("text", composeText(input));
    const response = await callUpstream(
      "https://oauth.reddit.com/api/submit",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "User-Agent": "mesa/0.1" }, body },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const json = response.json.json as { data?: { id?: string; url?: string }; errors?: unknown[] } | undefined;
    if (json?.errors && json.errors.length > 0) {
      return { ok: false, code: "REJECTED", message: "Reddit rechazó el envío.", retryable: false };
    }
    const id = String(json?.data?.id || "");
    if (!id) return { ok: false, code: "UPSTREAM", message: "Reddit no devolvió el identificador.", retryable: false };
    return { ok: true, externalId: id, externalUrl: json?.data?.url };
  },
};
