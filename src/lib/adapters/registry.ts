import { bluesky, discord, mastodon, telegram, tiktok, tumblr, vk, wechat } from "@/lib/adapters/messages";
import { facebook } from "@/lib/adapters/facebook";
import { messenger, snapchat, twitch, whatsapp } from "@/lib/adapters/manual";
import { instagram, threads } from "@/lib/adapters/meta";
import { linkedin, pinterest, reddit, x, youtube } from "@/lib/adapters/networks";
import type { SocialAdapter } from "@/lib/adapters/types";

const ADAPTERS: SocialAdapter[] = [
  facebook,
  instagram,
  youtube,
  tiktok,
  x,
  threads,
  linkedin,
  pinterest,
  snapchat,
  reddit,
  telegram,
  whatsapp,
  messenger,
  discord,
  bluesky,
  mastodon,
  tumblr,
  twitch,
  vk,
  wechat,
];

export const ADAPTERS_BY_ID = new Map(ADAPTERS.map((adapter) => [adapter.platformId, adapter]));

export function getAdapter(platformId: string) {
  const adapter = ADAPTERS_BY_ID.get(platformId);
  if (!adapter) throw new Error("No hay adaptador para esa red.");
  return adapter;
}
