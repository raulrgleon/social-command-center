"use client";

import { useEffect, useState } from "react";
import { BrandIcon } from "@/components/brand-icon";

type Platform = { id: string; name: string; mode: string; auth: string; summary: string; missingEnv: string[]; ready: boolean; docsUrl: string; publishSupported: boolean };
type Account = { id: string; platformId: string; displayName: string; status: string; isDemo: boolean; canPublish: boolean; canRead: boolean; canMetrics: boolean; lastSyncAt: string | null; lastSyncError: string | null };

export function AccountsDesk() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  function reload() {
    fetch("/api/platforms").then((response) => response.json()).then((data) => setPlatforms(data.platforms || []));
    fetch("/api/accounts").then((response) => response.json()).then((data) => setAccounts(data.accounts || []));
  }
  useEffect(reload, []);

  async function connect(platform: Platform) {
    if (platform.auth === "oauth") {
      const response = await fetch(`/api/integrations/${platform.id}/start`);
      const data = await response.json();
      if (!response.ok) { setMessage(data.missing ? `Faltan en el servidor: ${data.missing.join(", ")}` : data.error); return; }
      window.location.assign(data.url);
      return;
    }
    setOpen(platform.id);
  }

  async function saveToken(platformId: string) {
    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platformId, ...form }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "No se pudo conectar."); return; }
    setMessage("Cuenta conectada tras la comprobación oficial.");
    setOpen(null);
    reload();
  }

  return (
    <div className="p-4 lg:p-8">
      <h1 className="font-serif text-4xl">Cuentas</h1>
      <p className="mt-2 max-w-2xl text-muted">Puedes tener varias cuentas de la misma red. Los tokens se guardan cifrados en el servidor y no vuelven al navegador.</p>
      {message ? <p className="mt-4 rounded-xl bg-amber-soft px-3 py-2 text-sm">{message}</p> : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {platforms.map((platform) => {
          const rows = accounts.filter((account) => account.platformId === platform.id);
          return (
            <article key={platform.id} className="rounded-2xl border border-line bg-panel p-4">
              <header className="flex items-center gap-3">
                <BrandIcon id={platform.id} className="h-6 w-6" />
                <div>
                  <h2 className="text-lg">{platform.name}</h2>
                  <p className="text-xs text-muted">{platform.publishSupported ? "Publicación oficial preparada" : "Solo manual"} · {platform.mode === "manual_only" ? "sin API de publicación" : platform.ready ? "credenciales de app listas" : "faltan credenciales de app"}</p>
                </div>
              </header>
              <p className="mt-3 text-sm leading-6 text-muted">{platform.summary}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {rows.length === 0 ? <li className="text-muted">Sin cuentas.</li> : rows.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2">
                    <span>{account.displayName}<span className="block text-xs text-muted">{account.isDemo ? "Demostración" : account.status} · publicar {account.canPublish ? "sí" : "no"} · leer {account.canRead ? "sí" : "no"} · métricas {account.canMetrics ? "sí" : "no"}</span></span>
                    {!account.isDemo && account.status === "CONNECTED" ? <button className="text-sm text-signal" onClick={async () => { const response = await fetch(`/api/accounts/${account.id}/sync`, { method: "POST" }); const data = await response.json(); setMessage(response.ok ? `Sincronizadas ${data.synced} publicaciones externas.` : data.error); }}>Sincronizar</button> : null}
                  </li>
                ))}
              </ul>
              {platform.auth !== "none" ? <button className="mt-3 rounded-full border border-line px-3 py-1 text-sm" onClick={() => void connect(platform)}>Conectar</button> : <p className="mt-3 text-sm">Usa el texto preparado en el escritorio.</p>}
              <a className="mt-2 block text-xs text-signal" href={platform.docsUrl}>Documentación oficial</a>
              {open === platform.id ? (
                <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); void saveToken(platform.id); }}>
                  <input required placeholder="Nombre visible" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
                  {platform.id === "telegram" ? <><input placeholder="Token del bot" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, botToken: event.target.value })} /><input placeholder="Chat o canal" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, chatId: event.target.value })} /></> : null}
                  {platform.id === "discord" ? <input placeholder="https://discord.com/api/webhooks/…" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, webhookUrl: event.target.value })} /> : null}
                  {platform.id === "bluesky" ? <><input placeholder="identificador.bsky.social" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, identifier: event.target.value })} /><input placeholder="Contraseña de aplicación" type="password" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, appPassword: event.target.value })} /></> : null}
                  {platform.id === "mastodon" ? <><input placeholder="https://instancia.social" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, instanceUrl: event.target.value })} /><input placeholder="Token de acceso" type="password" className="rounded-xl border border-line bg-paper px-3 py-2" onChange={(event) => setForm({ ...form, accessToken: event.target.value })} /></> : null}
                  <button className="rounded-full bg-ink px-3 py-2 text-paper">Comprobar y guardar</button>
                </form>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
