"use client";

import { useEffect, useMemo, useState } from "react";
import { BrandIcon } from "@/components/brand-icon";
import { PlatformPreview } from "@/components/previews";
import { PLATFORMS, TONES, getPlatform } from "@/lib/platforms/catalog";
import { validateVersion } from "@/lib/platforms/validation";

type Account = {
  id: string;
  platformId: string;
  displayName: string;
  status: string;
  isDemo: boolean;
  canPublish: boolean;
  lastSyncAt: string | null;
};
type Media = { id: string; kind: string; filename: string };
type Version = { platformId: string; title: string; body: string; linkUrl: string; hashtags: string[]; customized: boolean };
type Post = {
  id: string;
  title: string;
  masterBody: string;
  linkUrl: string;
  tone: string;
  status: string;
  isDemo: boolean;
  plannedFor: string | null;
  versions: Version[];
  media: Media[];
};
type Counts = { localPublished: number; externalPublished: number; scheduled: number; errors: number; manualRequired: number; demoScheduled: number };
type DispatchRow = { accountId: string; platformId: string; status: string; message: string; manualSteps: string[]; copyText: string };

const emptyCount: Counts = { localPublished: 0, externalPublished: 0, scheduled: 0, errors: 0, manualRequired: 0, demoScheduled: 0 };

export function Composer({
  initialPost,
  accounts,
  timezone,
}: {
  initialPost: Post | null;
  accounts: Account[];
  timezone: string;
}) {
  const [post, setPost] = useState<Post | null>(initialPost);
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [body, setBody] = useState(initialPost?.masterBody ?? "");
  const [link, setLink] = useState(initialPost?.linkUrl ?? "");
  const [tone, setTone] = useState(initialPost?.tone ?? "informativo");
  const [versions, setVersions] = useState<Version[]>(initialPost?.versions ?? []);
  const [media, setMedia] = useState<Media[]>(initialPost?.media ?? []);
  const [focus, setFocus] = useState("facebook");
  const [editing, setEditing] = useState<"master" | string>("master");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [selected, setSelected] = useState<string[]>(accounts.filter((account) => account.isDemo).slice(0, 3).map((account) => account.id));
  const [when, setWhen] = useState("");
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [totals, setTotals] = useState(emptyCount);
  const [connected, setConnected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<DispatchRow[]>([]);
  const [aiIdea, setAiIdea] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/counters").then((response) => response.json()).then((data) => {
      setCounts(data.byPlatform || {});
      setTotals(data.totals || emptyCount);
      setConnected(data.connectedAccounts || 0);
    }).catch(() => setNotice("No se pudieron cargar los contadores."));
  }, [results]);

  const visiblePlatforms = PLATFORMS.filter((platform) => !hidden.includes(platform.id));
  const current = editing === "master"
    ? { title, body, linkUrl: link, hashtags: versions.find((version) => version.platformId === focus)?.hashtags ?? [] }
    : versions.find((version) => version.platformId === editing) ?? { title, body, linkUrl: link, hashtags: [] };
  const platform = getPlatform(focus);
  const warnings = useMemo(() => {
    if (!platform) return [];
    return validateVersion(platform, {
      title: current.title,
      body: current.body,
      linkUrl: current.linkUrl,
      hashtags: current.hashtags,
      mediaKinds: media.map((item) => item.kind as "IMAGE" | "VIDEO" | "DOCUMENT"),
    });
  }, [platform, current.title, current.body, current.linkUrl, current.hashtags, media]);

  async function ensurePost() {
    if (post) return post;
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, masterBody: body, linkUrl: link, tone, platformIds: versions.map((version) => version.platformId) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
    setPost(data.post);
    setVersions(data.post.versions);
    history.replaceState(null, "", `/escritorio?post=${data.post.id}`);
    return data.post as Post;
  }

  async function save() {
    setSaving(true);
    try {
      const currentPost = await ensurePost();
      const response = await fetch(`/api/posts/${currentPost.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, masterBody: body, linkUrl: link, tone, platformIds: [...new Set([focus, ...versions.map((version) => version.platformId)])] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar.");
      setPost(data.post);
      setVersions(data.post.versions);
      setNotice("Borrador guardado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function editPlatform(platformId: string, patch: Partial<Version>) {
    const next = versions.map((version) => version.platformId === platformId ? { ...version, ...patch, customized: true } : version);
    setVersions(next);
    const version = next.find((item) => item.platformId === platformId);
    if (!version) return;
    const currentPost = await ensurePost();
    await fetch(`/api/posts/${currentPost.id}/versions/${platformId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: version.title, body: version.body, linkUrl: version.linkUrl, hashtags: version.hashtags }),
    });
  }

  async function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/media", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "No se pudo subir el archivo."); return; }
    const next = [...media, data.media];
    setMedia(next);
    const currentPost = await ensurePost();
    await fetch(`/api/posts/${currentPost.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaIds: next.map((item) => item.id) }),
    });
  }

  async function askAi(task: string) {
    setAiNote("Preparando…");
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, text: body, idea: aiIdea, tone, url: task === "from_article" ? aiIdea : undefined, platformIds: [focus] }),
    });
    const data = await response.json();
    if (!response.ok) { setAiNote(data.error || "No se pudo preparar."); return; }
    setAiNote(data.result.notice);
    if (task === "adapt" && data.result.versions?.[0]) {
      const version = data.result.versions[0];
      await editPlatform(focus, { title: version.title, body: version.body, hashtags: version.hashtags || [] });
      return;
    }
    if (data.result.text) {
      if (editing === "master") setBody(data.result.text);
      else await editPlatform(editing, { body: data.result.text });
    }
    if (data.result.hashtags?.length) {
      const existing = versions.find((version) => version.platformId === focus);
      if (existing) await editPlatform(focus, { hashtags: data.result.hashtags });
    }
  }

  async function publish(mode: "now" | "schedule") {
    setNotice("");
    const currentPost = await ensurePost();
    await save();
    const response = await fetch(`/api/posts/${currentPost.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accountIds: selected, scheduledFor: mode === "schedule" && when ? new Date(when).toISOString() : null }),
    });
    const data = await response.json();
    if (!response.ok) { setNotice(data.error || "No se pudo distribuir."); return; }
    setResults(data.results || []);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") { event.preventDefault(); void save(); }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void publish("now"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const previewBody = editing === "master" ? body : current.body;
  const previewTitle = editing === "master" ? title : current.title;

  return (
    <div className="desk-grid">
      <aside className="bg-rail text-rail-ink">
        <div className="grid grid-cols-2 gap-2 border-b border-white/10 p-4 text-sm">
          <Stat label="Hoy" value={totals.localPublished + totals.externalPublished} />
          <Stat label="Conectadas" value={connected} />
          <Stat label="Pendientes" value={totals.scheduled + totals.manualRequired} />
          <Stat label="Errores" value={totals.errors} />
        </div>
        <p className="px-4 pt-4 text-xs text-rail-muted">Zona horaria {timezone}. El día cambia a medianoche local. Los conteos locales y los sincronizados van aparte.</p>
        <ul className="max-h-[calc(100vh-220px)] overflow-auto p-2">
          {visiblePlatforms.map((item) => {
            const count = counts[item.id] || emptyCount;
            const active = focus === item.id;
            return (
              <li key={item.id}>
                <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${active ? "bg-white/10" : "hover:bg-white/5"}`} onClick={() => { setFocus(item.id); if (editing !== "master") setEditing(item.id); }}>
                  <BrandIcon id={item.id} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="font-serif text-xl tabular-nums">{count.localPublished + count.externalPublished}</span>
                    </span>
                    <span className="block text-xs text-rail-muted">
                      {count.localPublished} locales · {count.externalPublished} sincronizadas · {count.scheduled + count.demoScheduled} programadas
                      {count.errors ? ` · ${count.errors} errores` : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="m-3 text-xs text-rail-muted underline" onClick={() => setHidden(hidden.length ? [] : ["vk", "wechat"])}>{hidden.length ? "Mostrar todas" : "Ocultar VK y WeChat"}</button>
      </aside>

      <main className="min-w-0 px-4 py-5 lg:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button className={`rounded-full px-3 py-1 text-sm ${editing === "master" ? "bg-ink text-paper" : "border border-line"}`} onClick={() => setEditing("master")}>Maestro</button>
          {versions.map((version) => (
            <button key={version.platformId} className={`rounded-full px-3 py-1 text-sm ${editing === version.platformId ? "bg-ink text-paper" : "border border-line"}`} onClick={() => { setEditing(version.platformId); setFocus(version.platformId); }}>
              {getPlatform(version.platformId)?.name}{version.customized ? " · propia" : ""}
            </button>
          ))}
          <button className="rounded-full border border-line px-3 py-1 text-sm" onClick={() => {
            if (versions.some((version) => version.platformId === focus)) return;
            setVersions([...versions, { platformId: focus, title, body, linkUrl: link, hashtags: [], customized: false }]);
          }}>Añadir {platform?.name}</button>
        </div>
        <label className="block text-sm text-muted" htmlFor="titulo">Título</label>
        <input id="titulo" value={editing === "master" ? title : current.title} onChange={(event) => editing === "master" ? setTitle(event.target.value) : void editPlatform(editing, { title: event.target.value })} className="mb-3 w-full border-b border-line bg-transparent py-2 font-serif text-3xl outline-none" />
        <label className="block text-sm text-muted" htmlFor="cuerpo">Texto</label>
        <textarea id="cuerpo" value={editing === "master" ? body : current.body} onChange={(event) => editing === "master" ? setBody(event.target.value) : void editPlatform(editing, { body: event.target.value })} className="min-h-48 w-full resize-y bg-transparent py-2 text-lg leading-8 outline-none" placeholder="Escribe la pieza. La versión de cada red se conserva aparte." />
        <div className="mt-3 flex flex-wrap gap-3">
          <input aria-label="Enlace" value={editing === "master" ? link : current.linkUrl} onChange={(event) => editing === "master" ? setLink(event.target.value) : void editPlatform(editing, { linkUrl: event.target.value })} placeholder="https://…" className="min-w-48 flex-1 rounded-full border border-line bg-panel px-4 py-2" />
          <select aria-label="Tono" value={tone} onChange={(event) => setTone(event.target.value)} className="rounded-full border border-line bg-panel px-3 py-2">
            {TONES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <label className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm">
            Adjuntar
            <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {["😀", "✨", "📌", "🔥", "📰"].map((emoji) => <button key={emoji} className="rounded-full border border-line px-3 py-1" onClick={() => setBody((value) => `${value}${emoji}`)}>{emoji}</button>)}
          {media.map((item) => <span key={item.id} className="rounded-full bg-signal-soft px-3 py-1 text-sm text-signal">{item.filename}</span>)}
        </div>
        <section className="mt-6 rounded-2xl border border-line bg-panel p-4">
          <h2 className="font-serif text-2xl">Ayuda de redacción</h2>
          <p className="mt-1 text-sm text-muted">La IA propone texto. No publica sola.</p>
          <textarea value={aiIdea} onChange={(event) => setAiIdea(event.target.value)} placeholder="Idea, o una URL https para extraer un artículo" className="mt-3 min-h-20 w-full rounded-xl border border-line bg-paper p-3" />
          <div className="mt-3 flex flex-wrap gap-2">
            {[["from_idea", "Desde la idea"], ["from_article", "Desde URL"], ["rewrite", "Mejorar"], ["headlines", "Titulares"], ["hashtags", "Hashtags"], ["shorten", "Acortar"], ["expand", "Esquema"], ["adapt", "Adaptar a esta red"], ["suggest_times", "Horarios reales"], ["duplicates", "Buscar parecidos"]].map(([task, label]) => (
              <button key={task} className="rounded-full border border-line px-3 py-1 text-sm" onClick={() => void askAi(task)}>{label}</button>
            ))}
          </div>
          {aiNote ? <p className="mt-3 text-sm text-muted">{aiNote}</p> : null}
        </section>
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-2xl">Vista en {platform?.name}</h2>
            <div className="flex gap-2">
              <button className={`rounded-full px-3 py-1 text-sm ${device === "mobile" ? "bg-ink text-paper" : "border border-line"}`} onClick={() => setDevice("mobile")}>Móvil</button>
              <button className={`rounded-full px-3 py-1 text-sm ${device === "desktop" ? "bg-ink text-paper" : "border border-line"}`} onClick={() => setDevice("desktop")}>Escritorio</button>
            </div>
          </div>
          {warnings.length > 0 ? (
            <ul className="mb-3 space-y-1">
              {warnings.map((warning) => <li key={warning.code} className={`rounded-xl px-3 py-2 text-sm ${warning.level === "error" ? "bg-danger-soft text-danger" : "bg-amber-soft text-amber"}`}>{warning.message}</li>)}
            </ul>
          ) : null}
          <div className="preview-swap grid justify-items-center rounded-3xl bg-[#e7e1d6] p-6 dark:bg-[#0c1118]">
            <PlatformPreview platformId={focus} title={previewTitle} body={previewBody} link={editing === "master" ? link : current.linkUrl} hashtags={current.hashtags} media={media} accountName={accounts.find((account) => account.platformId === focus)?.displayName || platform?.name || "Cuenta"} device={device} />
          </div>
          {platform ? <p className="mt-3 text-sm text-muted">{platform.summary}</p> : null}
        </section>
      </main>

      <aside className="border-l border-line bg-panel p-4">
        <h2 className="font-serif text-2xl">Distribuir</h2>
        <button className="mt-3 text-sm text-signal" onClick={() => setSelected(accounts.filter((account) => account.canPublish || account.isDemo).map((account) => account.id))}>Seleccionar cuentas visibles</button>
        <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
          {accounts.filter((account) => account.platformId === focus || selected.includes(account.id)).concat(accounts.filter((account) => account.platformId !== focus && !selected.includes(account.id))).slice(0, 30).map((account) => (
            <li key={account.id}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(account.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, account.id] : selected.filter((id) => id !== account.id))} />
                <span>
                  <span className="block">{account.displayName}</span>
                  <span className="text-muted">{account.isDemo ? "Demostración" : account.status === "CONNECTED" ? "Conectada" : "Sin autorización"}{account.lastSyncAt ? ` · sync ${new Date(account.lastSyncAt).toLocaleString("es")}` : ""}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <label className="mt-4 block text-sm text-muted" htmlFor="cuando">Programar</label>
        <input id="cuando" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2" />
        <div className="mt-4 grid gap-2">
          <button className="rounded-full bg-signal px-4 py-2 text-white" onClick={() => void publish("now")}>Publicar ahora</button>
          <button className="rounded-full border border-line px-4 py-2" onClick={() => void publish("schedule")}>Programar</button>
          <button className="rounded-full border border-line px-4 py-2" onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar borrador"}</button>
          <button className="rounded-full border border-line px-4 py-2" onClick={async () => { const currentPost = await ensurePost(); await fetch(`/api/posts/${currentPost.id}/publish`, { method: "PUT" }); setNotice("Se creó una copia."); }}>Duplicar</button>
          <button className="rounded-full border border-line px-4 py-2" onClick={async () => {
            const name = window.prompt("Nombre de la plantilla");
            if (!name) return;
            await fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, masterBody: body, tone, versions }) });
            setNotice("Plantilla guardada.");
          }}>Guardar plantilla</button>
        </div>
        {notice ? <p className="mt-4 text-sm">{notice}</p> : null}
        <ul className="mt-4 space-y-3">
          {results.map((result) => (
            <li key={result.accountId} className="rounded-xl border border-line p-3 text-sm">
              <p className="font-medium">{result.platformId} · {labelStatus(result.status)}</p>
              <p className="mt-1 text-muted">{result.message}</p>
              {result.copyText ? <button className="mt-2 text-signal" onClick={() => navigator.clipboard.writeText(result.copyText)}>Copiar texto preparado</button> : null}
              {result.manualSteps?.length ? <ol className="mt-2 list-decimal pl-4 text-muted">{result.manualSteps.map((step) => <li key={step}>{step}</li>)}</ol> : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><p className="font-serif text-2xl tabular-nums">{value}</p><p className="text-xs text-rail-muted">{label}</p></div>;
}

function labelStatus(status: string) {
  const labels: Record<string, string> = {
    PUBLISHED: "Publicado correctamente",
    SCHEDULED: "Programado",
    PENDING: "Pendiente",
    PUBLISHING: "Enviando",
    NEEDS_AUTH: "Requiere autorización",
    FAILED: "Error",
    MANUAL_REQUIRED: "Publicación manual",
    NOT_COMPATIBLE: "No compatible con publicación automática",
  };
  return labels[status] || status;
}
