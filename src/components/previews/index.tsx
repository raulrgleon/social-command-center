export type PreviewMedia = { id: string; kind: string; filename: string };
export type PreviewWarning = { level: "error" | "warning"; message: string };

export type PreviewProps = {
  title: string;
  body: string;
  link: string;
  hashtags: string[];
  media: PreviewMedia[];
  accountName: string;
  device: "mobile" | "desktop";
};

function textOf(props: PreviewProps) {
  const tags = props.hashtags.filter(Boolean).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  const missing = tags.filter((tag) => !props.body.includes(tag));
  return [props.body.trim(), missing.join(" ")].filter(Boolean).join("\n");
}

function MediaBlock({ media, ratio = "aspect-video" }: { media: PreviewMedia[]; ratio?: string }) {
  const first = media[0];
  if (!first) return <div className={`${ratio} bg-[#d9d3c7] dark:bg-[#243041]`} />;
  if (first.kind === "VIDEO") {
    return <div className={`${ratio} grid place-items-center bg-[#11161f] text-sm text-white`}>Video · {first.filename}</div>;
  }
  if (first.kind === "DOCUMENT") {
    return <div className="border border-dashed border-line px-3 py-4 text-sm">Documento · {first.filename}</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/media/${first.id}`} alt={first.filename} className={`${ratio} w-full object-cover`} />
  );
}

export function FacebookPreview(props: PreviewProps) {
  const width = props.device === "mobile" ? "max-w-[380px]" : "max-w-[560px]";
  return (
    <article className={`${width} overflow-hidden rounded-xl bg-white text-[#1c1e21] shadow-sm`}>
      <header className="flex items-center gap-3 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-[#1877f2]" />
        <div>
          <p className="font-semibold">{props.accountName}</p>
          <p className="text-xs text-[#65676b]">Ahora · Público</p>
        </div>
      </header>
      <p className="whitespace-pre-wrap px-4 pb-3 text-[15px] leading-6">{textOf(props)}</p>
      {props.link ? <p className="px-4 pb-3 text-sm text-[#1877f2]">{props.link}</p> : null}
      <MediaBlock media={props.media} ratio="aspect-[1.9/1]" />
      <footer className="grid grid-cols-3 border-t border-[#e4e6eb] py-2 text-center text-sm text-[#65676b]">
        <span>Me gusta</span><span>Comentar</span><span>Compartir</span>
      </footer>
    </article>
  );
}

export function InstagramPreview(props: PreviewProps) {
  return (
    <article className="w-[320px] overflow-hidden rounded-2xl border border-[#dbdbdb] bg-white text-black">
      <header className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">{props.accountName}</header>
      <MediaBlock media={props.media} ratio="aspect-square" />
      <p className="whitespace-pre-wrap px-3 py-3 text-sm leading-5"><span className="font-semibold">{props.accountName} </span>{textOf(props)}</p>
    </article>
  );
}

export function XPreview(props: PreviewProps) {
  return (
    <article className={`${props.device === "mobile" ? "max-w-[380px]" : "max-w-[560px]"} rounded-2xl border border-[#2f3336] bg-black p-4 text-white`}>
      <header className="mb-2 flex gap-3">
        <div className="h-10 w-10 rounded-full bg-[#2f3336]" />
        <div><p className="font-semibold">{props.accountName}</p><p className="text-sm text-[#71767b]">@cuenta</p></div>
      </header>
      <p className="whitespace-pre-wrap text-[15px] leading-6">{textOf(props)}</p>
      {props.media[0] ? <div className="mt-3 overflow-hidden rounded-2xl border border-[#2f3336]"><MediaBlock media={props.media} /></div> : null}
    </article>
  );
}

export function LinkedInPreview(props: PreviewProps) {
  return (
    <article className={`${props.device === "mobile" ? "max-w-[380px]" : "max-w-[560px]"} rounded-lg border border-[#e6e6e6] bg-white text-[#1d2226]`}>
      <header className="flex gap-3 p-4">
        <div className="h-12 w-12 rounded-full bg-[#0a66c2]" />
        <div><p className="font-semibold">{props.accountName}</p><p className="text-xs text-[#666]">Publicación profesional</p></div>
      </header>
      <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6">{textOf(props)}</p>
      {props.title ? <p className="border-t border-[#e6e6e6] px-4 py-3 text-sm font-semibold">{props.title}</p> : null}
      <MediaBlock media={props.media} />
    </article>
  );
}

export function TikTokPreview(props: PreviewProps) {
  return (
    <article className="relative h-[560px] w-[300px] overflow-hidden rounded-[28px] bg-black text-white">
      <MediaBlock media={props.media} ratio="h-full" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-4">
        <p className="font-semibold">{props.accountName}</p>
        <p className="mt-1 line-clamp-4 text-sm">{textOf(props)}</p>
      </div>
    </article>
  );
}

export function YouTubePreview(props: PreviewProps) {
  return (
    <article className={props.device === "mobile" ? "max-w-[360px]" : "max-w-[640px]"}>
      <div className="overflow-hidden rounded-xl"><MediaBlock media={props.media} ratio="aspect-video" /></div>
      <h3 className="mt-3 font-serif text-xl leading-tight">{props.title || "Sin título"}</h3>
      <p className="mt-1 text-sm text-muted">{props.accountName}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{textOf(props)}</p>
    </article>
  );
}

export function ThreadsPreview(props: PreviewProps) {
  return (
    <article className="max-w-[420px] rounded-2xl border border-line bg-panel p-4">
      <p className="text-sm font-semibold">{props.accountName}</p>
      <p className="mt-2 whitespace-pre-wrap leading-6">{textOf(props)}</p>
    </article>
  );
}

export function PinterestPreview(props: PreviewProps) {
  return (
    <article className="w-[240px]">
      <div className="overflow-hidden rounded-2xl"><MediaBlock media={props.media} ratio="aspect-[3/4]" /></div>
      <h3 className="mt-2 font-semibold">{props.title || "Pin"}</h3>
      <p className="text-sm text-muted">{textOf(props).slice(0, 140)}</p>
    </article>
  );
}

export function RedditPreview(props: PreviewProps) {
  return (
    <article className="max-w-[560px] rounded-md border border-[#ccc] bg-white p-4 text-[#1a1a1b]">
      <p className="text-xs text-[#787c7e]">r/{props.accountName}</p>
      <h3 className="mt-1 text-lg font-semibold">{props.title || "Sin título"}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{textOf(props)}</p>
    </article>
  );
}

export function ChatPreview(props: PreviewProps & { accent: string }) {
  return (
    <article className="max-w-[420px] rounded-2xl bg-[#e7f3ef] p-3 text-[#10211c] dark:bg-[#16332e] dark:text-[#e8f6f2]">
      <p className="mb-1 text-xs font-semibold" style={{ color: props.accent }}>{props.accountName}</p>
      <p className="whitespace-pre-wrap rounded-2xl bg-white px-3 py-2 text-sm leading-6 text-[#10211c]">{textOf(props)}</p>
    </article>
  );
}

export function BlueskyPreview(props: PreviewProps) {
  return (
    <article className="max-w-[460px] rounded-xl border border-[#d4e4ff] bg-white p-4 text-[#0c1b33]">
      <p className="font-semibold text-[#1185fe]">{props.accountName}</p>
      <p className="mt-2 whitespace-pre-wrap leading-6">{textOf(props)}</p>
    </article>
  );
}

export function MastodonPreview(props: PreviewProps) {
  return (
    <article className="max-w-[460px] rounded-lg border border-[#c9b6e4] bg-[#f7f3fc] p-4 text-[#1f1430]">
      <p className="font-semibold text-[#563acc]">{props.accountName}</p>
      <p className="mt-2 whitespace-pre-wrap leading-6">{textOf(props)}</p>
    </article>
  );
}

const map = {
  facebook: FacebookPreview,
  instagram: InstagramPreview,
  x: XPreview,
  linkedin: LinkedInPreview,
  tiktok: TikTokPreview,
  youtube: YouTubePreview,
  threads: ThreadsPreview,
  pinterest: PinterestPreview,
  reddit: RedditPreview,
  bluesky: BlueskyPreview,
  mastodon: MastodonPreview,
} as const;

export function PlatformPreview(props: PreviewProps & { platformId: string }) {
  const Known = map[props.platformId as keyof typeof map];
  if (Known) return <Known {...props} />;
  if (props.platformId === "telegram" || props.platformId === "whatsapp" || props.platformId === "messenger" || props.platformId === "discord") {
    const accent = props.platformId === "whatsapp" ? "#128c7e" : props.platformId === "discord" ? "#5865f2" : "#229ed9";
    return <ChatPreview {...props} accent={accent} />;
  }
  return (
    <article className="max-w-[480px] rounded-xl border border-line bg-panel p-4">
      <p className="text-sm text-muted">{props.accountName}</p>
      {props.title ? <h3 className="mt-2 font-serif text-2xl">{props.title}</h3> : null}
      <p className="mt-3 whitespace-pre-wrap leading-7">{textOf(props)}</p>
      <div className="mt-3"><MediaBlock media={props.media} /></div>
    </article>
  );
}
