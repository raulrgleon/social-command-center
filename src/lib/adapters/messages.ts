import { callUpstream, composeText, manual, needsAuth, type SocialAdapter } from "@/lib/adapters/types";

export const telegram: SocialAdapter = {
  platformId: "telegram",
  async publish(input) {
    const token = input.credentials.botToken;
    const chatId = input.credentials.chatId || input.externalId;
    if (!token || !chatId) return needsAuth("Indica el token del bot y el identificador del canal.");
    const image = input.media.find((item) => item.kind === "IMAGE" && item.bytes);
    if (image?.bytes) {
      const body = new FormData();
      body.set("chat_id", chatId);
      body.set("caption", composeText(input).slice(0, 1024));
      body.set("photo", new Blob([Buffer.from(image.bytes)], { type: image.mimeType }), image.filename);
      const response = await callUpstream(`https://api.telegram.org/bot${token}/sendPhoto`, { method: "POST", body }, input.fetchImpl);
      if (!response.ok) return response;
      const result = response.json.result as { message_id?: number } | undefined;
      if (!response.json.ok || !result?.message_id) return { ok: false, code: "UPSTREAM", message: "Telegram no confirmó el mensaje.", retryable: false };
      return { ok: true, externalId: String(result.message_id) };
    }
    const response = await callUpstream(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: composeText(input).slice(0, 4096) }) },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const result = response.json.result as { message_id?: number } | undefined;
    if (!response.json.ok || !result?.message_id) return { ok: false, code: "UPSTREAM", message: "Telegram no confirmó el mensaje.", retryable: false };
    return { ok: true, externalId: String(result.message_id) };
  },
};

export const discord: SocialAdapter = {
  platformId: "discord",
  async publish(input) {
    const webhook = input.credentials.webhookUrl;
    let webhookUrl: URL;
    try {
      webhookUrl = new URL(webhook || "");
    } catch {
      return needsAuth("Pega un webhook oficial de Discord.");
    }
    const officialHost = webhookUrl.hostname === "discord.com" || webhookUrl.hostname === "discordapp.com";
    if (webhookUrl.protocol !== "https:" || !officialHost || !webhookUrl.pathname.startsWith("/api/webhooks/")) {
      return needsAuth("El webhook debe ser https://discord.com/api/webhooks/…");
    }
    webhookUrl.searchParams.set("wait", "true");
    const response = await callUpstream(
      webhookUrl.toString(),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: composeText(input).slice(0, 2000) }) },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const id = String(response.json.id || "");
    if (!id) return { ok: false, code: "UNCERTAIN", message: "Discord no confirmó el mensaje.", retryable: false };
    return { ok: true, externalId: id };
  },
};

export const bluesky: SocialAdapter = {
  platformId: "bluesky",
  async publish(input) {
    const identifier = input.credentials.identifier;
    const password = input.credentials.appPassword;
    if (!identifier || !password) return needsAuth("Indica el identificador y una contraseña de aplicación de Bluesky.");
    const session = await callUpstream(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) },
      input.fetchImpl,
    );
    if (!session.ok) return session;
    const access = String(session.json.accessJwt || "");
    const did = String(session.json.did || "");
    if (!access || !did) return { ok: false, code: "NEEDS_AUTH", message: "Bluesky no abrió la sesión.", retryable: false };
    const text = composeText(input).slice(0, 300);
    const created = await callUpstream(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: did,
          collection: "app.bsky.feed.post",
          record: { $type: "app.bsky.feed.post", text, createdAt: new Date().toISOString() },
        }),
      },
      input.fetchImpl,
    );
    if (!created.ok) return created;
    const uri = String(created.json.uri || "");
    if (!uri) return { ok: false, code: "UPSTREAM", message: "Bluesky no devolvió el registro.", retryable: false };
    return { ok: true, externalId: uri };
  },
  async listRecent(input) {
    const actor = input.credentials.identifier || input.externalId;
    if (!actor) return needsAuth("Falta el identificador de Bluesky.");
    const url = new URL("https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed");
    url.searchParams.set("actor", actor);
    url.searchParams.set("limit", "10");
    const response = await callUpstream(url.toString(), { method: "GET" }, input.fetchImpl);
    if (!response.ok) return response;
    const feed = Array.isArray(response.json.feed) ? response.json.feed : [];
    return {
      ok: true,
      items: feed.map((item) => {
        const row = item as { post?: { uri?: string; record?: { text?: string; createdAt?: string } } };
        return {
          externalId: String(row.post?.uri || ""),
          text: String(row.post?.record?.text || ""),
          publishedAt: new Date(row.post?.record?.createdAt || Date.now()),
          permalink: "",
        };
      }).filter((item) => item.externalId),
    };
  },
};

export const mastodon: SocialAdapter = {
  platformId: "mastodon",
  async publish(input) {
    const token = input.credentials.accessToken;
    const instance = (input.credentials.instanceUrl || "").replace(/\/$/, "");
    if (!token || !instance.startsWith("https://")) return needsAuth("Indica la instancia https y el token de Mastodon.");
    const response = await callUpstream(
      `${instance}/api/v1/statuses`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: composeText(input).slice(0, 500) }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const id = String(response.json.id || "");
    if (!id) return { ok: false, code: "UPSTREAM", message: "Mastodon no devolvió el estado.", retryable: false };
    return { ok: true, externalId: id, externalUrl: String(response.json.url || "") };
  },
  async listRecent(input) {
    const token = input.credentials.accessToken;
    const instance = (input.credentials.instanceUrl || "").replace(/\/$/, "");
    if (!token || !instance.startsWith("https://")) return needsAuth("La cuenta de Mastodon no está conectada.");
    const response = await callUpstream(`${instance}/api/v1/accounts/verify_credentials`, { headers: { Authorization: `Bearer ${token}` } }, input.fetchImpl);
    if (!response.ok) return response;
    const accountId = String(response.json.id || "");
    if (!accountId) return { ok: false, code: "UPSTREAM", message: "Mastodon no identificó la cuenta.", retryable: false };
    const list = await callUpstream(`${instance}/api/v1/accounts/${accountId}/statuses?limit=10`, { headers: { Authorization: `Bearer ${token}` } }, input.fetchImpl);
    if (!list.ok) return list;
    const rows = Array.isArray(list.json) ? list.json : Array.isArray(list.json.data) ? list.json.data : [];
    return {
      ok: true,
      items: rows.map((item) => {
        const row = item as { id?: string; content?: string; created_at?: string; url?: string };
        return {
          externalId: String(row.id || ""),
          text: String(row.content || "").replace(/<[^>]+>/g, ""),
          publishedAt: new Date(row.created_at || Date.now()),
          permalink: String(row.url || ""),
        };
      }).filter((item) => item.externalId),
    };
  },
};

export const tumblr: SocialAdapter = {
  platformId: "tumblr",
  async publish(input) {
    const token = input.credentials.accessToken;
    const blog = input.credentials.blogIdentifier || input.externalId;
    if (!token || !blog) return needsAuth("Falta el token de Tumblr o el identificador del blog.");
    const response = await callUpstream(
      `https://api.tumblr.com/v2/blog/${blog}/posts`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ content: [{ type: "text", text: composeText(input) }], state: "published" }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const id = String((response.json.response as { id?: string } | undefined)?.id || response.json.id || "");
    if (!id) return { ok: false, code: "UPSTREAM", message: "Tumblr no devolvió el post.", retryable: false };
    return { ok: true, externalId: id };
  },
};

export const tiktok: SocialAdapter = {
  platformId: "tiktok",
  async publish(input) {
    const token = input.credentials.accessToken;
    const video = input.media.find((item) => item.kind === "VIDEO" && item.bytes);
    if (!token) return needsAuth("Falta el token de TikTok.");
    if (!video?.bytes) return { ok: false, code: "NOT_COMPATIBLE", message: "TikTok necesita el archivo de video.", retryable: false };
    const size = video.bytes.byteLength;
    const response = await callUpstream(
      "https://open.tiktokapis.com/v2/post/publish/video/init/",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          post_info: { title: input.title.slice(0, 150), description: composeText(input).slice(0, 2200) },
          source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
        }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const data = response.json.data as { publish_id?: string; upload_url?: string } | undefined;
    if (!data?.publish_id || !data.upload_url) {
      return { ok: false, code: "UPSTREAM", message: "TikTok no inició la carga. Revisa si la app ya pasó la revisión.", retryable: false };
    }
    const uploaded = await callUpstream(
      data.upload_url,
      {
        method: "PUT",
        headers: {
          "Content-Type": video.mimeType,
          "Content-Length": String(size),
          "Content-Range": `bytes 0-${size - 1}/${size}`,
        },
        body: Buffer.from(video.bytes),
      },
      input.fetchImpl,
    );
    if (!uploaded.ok) return { ...uploaded, retryable: false };
    const status = await callUpstream(
      "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ publish_id: data.publish_id }),
      },
      input.fetchImpl,
    );
    if (!status.ok) return { ...status, retryable: false };
    const state = String((status.json.data as { status?: string } | undefined)?.status || "");
    if (state !== "PUBLISH_COMPLETE") {
      return {
        ok: false,
        code: "UNCERTAIN",
        message: `TikTok dejó la carga en «${state || "proceso"}». Revisa la cuenta antes de volver a intentarlo.`,
        retryable: false,
      };
    }
    return { ok: true, externalId: data.publish_id };
  },
};

export const vk: SocialAdapter = {
  platformId: "vk",
  async publish(input) {
    const token = input.credentials.accessToken;
    const ownerId = input.externalId;
    if (!token || !ownerId) return needsAuth("Falta el token de VK o el muro de destino.");
    const url = new URL("https://api.vk.com/method/wall.post");
    url.searchParams.set("owner_id", ownerId);
    url.searchParams.set("message", composeText(input).slice(0, 16384));
    url.searchParams.set("access_token", token);
    url.searchParams.set("v", "5.199");
    const response = await callUpstream(url.toString(), { method: "POST" }, input.fetchImpl);
    if (!response.ok) return response;
    if (response.json.error) {
      const error = response.json.error as { error_msg?: string };
      return { ok: false, code: "REJECTED", message: String(error.error_msg || "VK rechazó el muro."), retryable: false };
    }
    const postId = (response.json.response as { post_id?: number } | undefined)?.post_id;
    if (!postId) return { ok: false, code: "UPSTREAM", message: "VK no devolvió el post.", retryable: false };
    return { ok: true, externalId: String(postId) };
  },
};

export const wechat: SocialAdapter = {
  platformId: "wechat",
  async publish(input) {
    const token = input.credentials.accessToken;
    if (!token) return needsAuth("Falta el token de la cuenta oficial de WeChat.");
    if (!input.title.trim()) return { ok: false, code: "NOT_COMPATIBLE", message: "WeChat necesita un título para el borrador.", retryable: false };
    const response = await callUpstream(
      `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: [{ title: input.title.slice(0, 64), content: composeText(input), digest: composeText(input).slice(0, 120) }],
        }),
      },
      input.fetchImpl,
    );
    if (!response.ok) return response;
    const mediaId = String(response.json.media_id || "");
    if (!mediaId) return manual("WeChat no creó el borrador. Los Momentos siguen siendo manuales.");
    return { ok: true, externalId: mediaId };
  },
};
