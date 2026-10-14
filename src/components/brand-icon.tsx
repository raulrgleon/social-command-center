import {
  siBluesky, siDiscord, siFacebook, siInstagram, siMastodon, siMessenger, siPinterest,
  siReddit, siSnapchat, siTelegram, siThreads, siTiktok, siTumblr, siTwitch, siVk, siWechat, siWhatsapp, siX, siYoutube,
} from "simple-icons";

const ICONS = {
  facebook: siFacebook, instagram: siInstagram, youtube: siYoutube, tiktok: siTiktok, x: siX, threads: siThreads,
  pinterest: siPinterest, snapchat: siSnapchat, reddit: siReddit, telegram: siTelegram,
  whatsapp: siWhatsapp, messenger: siMessenger, discord: siDiscord, bluesky: siBluesky, mastodon: siMastodon,
  tumblr: siTumblr, twitch: siTwitch, vk: siVk, wechat: siWechat,
} as const;

export function BrandIcon({ id, className = "h-4 w-4" }: { id: string; className?: string }) {
  if (id === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect width="24" height="24" rx="4" fill="#0A66C2" />
        <text x="4" y="17" fill="white" fontSize="11" fontFamily="Arial">in</text>
      </svg>
    );
  }
  const icon = ICONS[id as keyof typeof ICONS];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d={icon.path} fill={`#${icon.hex}`} />
    </svg>
  );
}
