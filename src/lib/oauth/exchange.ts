import { callUpstream } from "@/lib/adapters/types";
import { redirectUri } from "@/lib/oauth/urls";

type TokenBundle = { accessToken: string; refreshToken?: string; expiresIn?: number; externalId?: string; name?: string };

async function formToken(url: string, body: URLSearchParams, headers?: HeadersInit) {
  const result = await callUpstream(url, { method: "POST", headers, body });
  if (!result.ok) throw new Error(result.message);
  return result.json;
}

export async function exchangeCode(platformId: string, code: string, verifier: string): Promise<TokenBundle> {
  const redirect = redirectUri(platformId);
  if (platformId === "facebook" || platformId === "instagram") {
    const url = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    url.searchParams.set("client_id", process.env.FACEBOOK_APP_ID || "");
    url.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("code", code);
    const result = await callUpstream(url.toString(), { method: "GET" });
    if (!result.ok) throw new Error(result.message);
    const accessToken = String(result.json.access_token || "");
    if (!accessToken) throw new Error("Facebook no entregó un token.");
    return { accessToken, expiresIn: Number(result.json.expires_in || 0) };
  }
  if (platformId === "threads") {
    const url = new URL("https://graph.threads.net/oauth/access_token");
    url.searchParams.set("client_id", process.env.THREADS_APP_ID || "");
    url.searchParams.set("client_secret", process.env.THREADS_APP_SECRET || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("code", code);
    url.searchParams.set("grant_type", "authorization_code");
    const result = await callUpstream(url.toString(), { method: "GET" });
    if (!result.ok) throw new Error(result.message);
    const accessToken = String(result.json.access_token || "");
    if (!accessToken) throw new Error("Threads no entregó un token.");
    return { accessToken, externalId: String(result.json.user_id || "") };
  }
  if (platformId === "linkedin") {
    const json = await formToken(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirect,
        client_id: process.env.LINKEDIN_CLIENT_ID || "",
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
      }),
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("LinkedIn no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || ""), expiresIn: Number(json.expires_in || 0) };
  }
  if (platformId === "x") {
    const clientId = process.env.X_CLIENT_ID || "";
    const clientSecret = process.env.X_CLIENT_SECRET || "";
    const json = await formToken(
      "https://api.x.com/2/oauth2/token",
      new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier, client_id: clientId }),
      { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("X no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || ""), expiresIn: Number(json.expires_in || 0) };
  }
  if (platformId === "youtube") {
    const json = await formToken(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: redirect,
        grant_type: "authorization_code",
      }),
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("Google no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || ""), expiresIn: Number(json.expires_in || 0) };
  }
  if (platformId === "pinterest") {
    const json = await formToken(
      "https://api.pinterest.com/v5/oauth/token",
      new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
      {
        Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("Pinterest no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || ""), expiresIn: Number(json.expires_in || 0) };
  }
  if (platformId === "reddit") {
    const json = await formToken(
      "https://www.reddit.com/api/v1/access_token",
      new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect }),
      {
        Authorization: `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
        "User-Agent": "mesa/0.1",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("Reddit no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || ""), expiresIn: Number(json.expires_in || 0) };
  }
  if (platformId === "tiktok") {
    const json = await formToken(
      "https://open.tiktokapis.com/v2/oauth/token/",
      new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirect,
      }),
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("TikTok no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || ""), expiresIn: Number(json.expires_in || 0), externalId: String(json.open_id || "") };
  }
  if (platformId === "tumblr") {
    const json = await formToken(
      "https://api.tumblr.com/v2/oauth2/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.TUMBLR_CONSUMER_KEY || "",
        client_secret: process.env.TUMBLR_CONSUMER_SECRET || "",
        redirect_uri: redirect,
      }),
    );
    const accessToken = String(json.access_token || "");
    if (!accessToken) throw new Error("Tumblr no entregó un token.");
    return { accessToken, refreshToken: String(json.refresh_token || "") };
  }
  if (platformId === "vk") {
    const url = new URL("https://oauth.vk.com/access_token");
    url.searchParams.set("client_id", process.env.VK_APP_ID || "");
    url.searchParams.set("client_secret", process.env.VK_APP_SECRET || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("code", code);
    const result = await callUpstream(url.toString(), { method: "GET" });
    if (!result.ok) throw new Error(result.message);
    const accessToken = String(result.json.access_token || "");
    if (!accessToken) throw new Error("VK no entregó un token.");
    return { accessToken, externalId: String(result.json.user_id || ""), expiresIn: Number(result.json.expires_in || 0) };
  }
  throw new Error("Esta red no tiene intercambio de código configurado.");
}
