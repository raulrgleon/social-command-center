"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addDays, format, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

type Item = { id: string; title: string; status: string; isDemo: boolean; plannedFor: string | null; platforms: string[] };

export function CalendarBoard() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [platform, setPlatform] = useState("");
  const [posts, setPosts] = useState<Item[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const url = new URL("/api/calendar", location.origin);
    url.searchParams.set("anchor", anchor.toISOString());
    if (platform) url.searchParams.set("platform", platform);
    fetch(url).then((response) => response.json()).then((data) => setPosts(data.posts || []));
  }, [anchor, platform]);

  const start = mode === "month" ? startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }) : mode === "week" ? startOfWeek(anchor, { weekStartsOn: 1 }) : anchor;
  const days = mode === "day" ? 1 : mode === "week" ? 7 : 42;

  async function drop(id: string, day: Date) {
    const response = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plannedFor: day.toISOString() }),
    });
    if (!response.ok) { setMessage("No se pudo mover la publicación."); return; }
    setPosts((current) => current.map((post) => post.id === id ? { ...post, plannedFor: day.toISOString() } : post));
    setMessage("Fecha actualizada. Si había una programación, se movió el mismo intervalo.");
  }

  return (
    <div className="p-4 lg:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-4xl">Calendario</h1>
        <div className="flex gap-2">
          {(["month", "week", "day"] as const).map((item) => <button key={item} className={`rounded-full px-3 py-1 text-sm ${mode === item ? "bg-ink text-paper" : "border border-line"}`} onClick={() => setMode(item)}>{item === "month" ? "Mes" : item === "week" ? "Semana" : "Día"}</button>)}
          <button className="rounded-full border border-line px-3 py-1" onClick={() => setAnchor(addDays(anchor, mode === "month" ? -30 : mode === "week" ? -7 : -1))}>Anterior</button>
          <button className="rounded-full border border-line px-3 py-1" onClick={() => setAnchor(addDays(anchor, mode === "month" ? 30 : mode === "week" ? 7 : 1))}>Siguiente</button>
        </div>
      </div>
      <label className="text-sm text-muted">Filtrar por red
        <input value={platform} onChange={(event) => setPlatform(event.target.value)} placeholder="facebook" className="ml-2 rounded-full border border-line bg-panel px-3 py-1" />
      </label>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
      <ul className="mt-4 space-y-2 lg:hidden">
        {posts.filter((post) => post.plannedFor).slice(0, 8).map((post) => (
          <li key={post.id}>
            <Link href={`/escritorio?post=${post.id}`} className="block rounded-2xl border border-line bg-panel px-3 py-3">
              <span className="block font-medium">{post.title || "Sin título"}</span>
              <span className="text-sm text-muted">{post.plannedFor ? format(new Date(post.plannedFor), "d MMM · HH:mm", { locale: es }) : ""} · {post.isDemo ? "Demostración · " : ""}{post.status}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className={`mt-4 grid gap-2 ${mode === "day" ? "grid-cols-1" : "grid-cols-2 md:grid-cols-7"}`}>
        {Array.from({ length: days }, (_, index) => {
          const day = addDays(start, index);
          const key = format(day, "yyyy-MM-dd");
          const items = posts.filter((post) => post.plannedFor?.slice(0, 10) === key);
          return (
            <div key={key} className="min-h-28 rounded-2xl border border-line bg-panel p-2" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/plain"); if (id) void drop(id, day); }}>
              <p className="text-xs text-muted">{format(day, "d MMM", { locale: es })}</p>
              {items.map((post) => (
                <Link key={post.id} href={`/escritorio?post=${post.id}`} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", post.id)} className="mt-2 block rounded-xl bg-paper px-2 py-1 text-sm">
                  <span className="block truncate">{post.title || "Sin título"}</span>
                  <span className="text-xs text-muted">{post.isDemo ? "Demostración · " : ""}{post.status}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
