import { createHash, randomBytes } from "node:crypto";
import { getPlatform } from "@/lib/platforms/catalog";

function must(name: string) {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
}

function base() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function redirectUri(platformId: string) {
  return `${base()}/api/integrations/${platformId}/callback`;
}

export function missingEnv(platformId: string) {
  const platform = getPlatform(platformId);
  if (!platform) return ["plataforma"];
  return platform.envKeys.filter((key) => !must(key));
}

export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createVerifier() {
  return randomBytes(32).toString("base64url");
}

export function authorizationUrl(platformId: string, state: string, verifier: string) {
  const redirect = redirectUri(platformId);
  if (platformId === "facebook" || platformId === "instagram") {
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", must("FACEBOOK_APP_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set(
      "scope",
      platformId === "instagram"
        ? "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish"
        : "pages_show_list,pages_manage_posts,pages_read_engagement,pages_read_user_content",
    );
    return url.toString();
  }
  if (platformId === "threads") {
    const url = new URL("https://threads.net/oauth/authorize");
    url.searchParams.set("client_id", must("THREADS_APP_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "threads_basic,threads_content_publish");
    url.searchParams.set("response_type", "code");
    return url.toString();
  }
  if (platformId === "linkedin") {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", must("LINKEDIN_CLIENT_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile w_member_social");
    return url.toString();
  }
  if (platformId === "x") {
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", must("X_CLIENT_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
    url.searchParams.set("code_challenge", codeChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }
  if (platformId === "youtube") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", must("GOOGLE_CLIENT_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
    return url.toString();
  }
  if (platformId === "pinterest") {
    const url = new URL("https://www.pinterest.com/oauth/");
    url.searchParams.set("client_id", must("PINTEREST_APP_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "boards:read,pins:read,pins:write,user_accounts:read");
    return url.toString();
  }
  if (platformId === "reddit") {
    const url = new URL("https://www.reddit.com/api/v1/authorize");
    url.searchParams.set("client_id", must("REDDIT_CLIENT_ID") || "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("duration", "permanent");
    url.searchParams.set("scope", "identity submit read");
    return url.toString();
  }
  if (platformId === "tiktok") {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", must("TIKTOK_CLIENT_KEY") || "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic,video.publish");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    return url.toString();
  }
  if (platformId === "tumblr") {
    const url = new URL("https://www.tumblr.com/oauth2/authorize");
    url.searchParams.set("client_id", must("TUMBLR_CONSUMER_KEY") || "");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "write offline_access");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", redirect);
    return url.toString();
  }
  if (platformId === "vk") {
    const url = new URL("https://oauth.vk.com/authorize");
    url.searchParams.set("client_id", must("VK_APP_ID") || "");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("display", "page");
    url.searchParams.set("scope", "wall,offline");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    url.searchParams.set("v", "5.199");
    return url.toString();
  }
  return null;
}
