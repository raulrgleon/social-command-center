"use client";

import { useEffect, useState } from "react";

type Series = { day: string; local: number; external: number };
type Payload = {
  today: number;
  externalToday: number;
  scheduled: number;
  errors: number;
  series: Series[];
  byPlatform: Array<{ platformId: string; count: number }>;
  metrics: Array<{ platformId: string; availability: string; reach: number | null; impressions: number | null; interactions: number | null; note: string }>;
  note: string;
};

export function AnalyticsView() {
  const [range, setRange] = useState("7");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/analytics?range=${range}`).then(async (response) => {
      const body = await response.json();
      if (!response.ok) setError(body.error || "No se pudo cargar.");
      else setData(body);
    }).catch(() => setError("No se pudo cargar la analítica."));
  }, [range]);
  const max = Math.max(1, ...(data?.series.map((item) => item.local + item.external) ?? [1]));
  return (
    <div className="p-4 lg:p-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="font-serif text-4xl">Analítica</h1>
        <select aria-label="Rango" value={range} onChange={(event) => setRange(event.target.value)} className="rounded-full border border-line bg-panel px-3 py-2">
          <option value="7">7 días</option>
          <option value="30">30 días</option>
        </select>
      </div>
      {error ? <p className="mt-4 text-danger">{error}</p> : null}
      {!data ? <p className="mt-6 text-muted">Cargando cifras confirmadas…</p> : (
        <>
          <p className="mt-2 max-w-2xl text-sm text-muted">{data.note}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Card label="Hoy, locales" value={data.today} />
            <Card label="Hoy, sincronizadas" value={data.externalToday} />
            <Card label="Programadas" value={data.scheduled} />
            <Card label="Errores" value={data.errors} />
          </div>
          <div className="mt-8 flex h-48 items-end gap-2">
            {data.series.map((item) => (
              <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end gap-1" style={{ height: "140px" }}>
                  <div className="w-1/2 rounded-t bg-signal" style={{ height: `${(item.local / max) * 100}%` }} title={`${item.local} locales`} />
                  <div className="w-1/2 rounded-t bg-amber" style={{ height: `${(item.external / max) * 100}%` }} title={`${item.external} sincronizadas`} />
                </div>
                <span className="text-[10px] text-muted">{item.day.slice(5)}</span>
              </div>
            ))}
          </div>
          <h2 className="mt-8 font-serif text-2xl">Por plataforma</h2>
          <ul className="mt-3 space-y-2">
            {data.byPlatform.length === 0 ? <li className="text-muted">Todavía no hay publicaciones confirmadas en este rango.</li> : data.byPlatform.map((item) => (
              <li key={item.platformId} className="flex items-center gap-3">
                <span className="w-28">{item.platformId}</span>
                <span className="h-2 rounded-full bg-signal" style={{ width: `${item.count * 24}px` }} />
                <span>{item.count}</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 font-serif text-2xl">Métricas de las redes</h2>
          {data.metrics.length === 0 ? <p className="mt-2 text-muted">Pendiente de sincronización. Mesa no rellena alcance, impresiones ni interacciones.</p> : (
            <table className="mt-3 w-full text-left text-sm">
              <thead><tr className="text-muted"><th>Red</th><th>Estado</th><th>Alcance</th><th>Impresiones</th><th>Interacciones</th></tr></thead>
              <tbody>
                {data.metrics.map((metric, index) => (
                  <tr key={`${metric.platformId}-${index}`} className="border-t border-line">
                    <td className="py-2">{metric.platformId}</td>
                    <td>{metric.availability === "AVAILABLE" ? "Disponible" : metric.availability === "UNAVAILABLE" ? "No disponible" : "Pendiente"}</td>
                    <td>{metric.reach ?? "—"}</td>
                    <td>{metric.impressions ?? "—"}</td>
                    <td>{metric.interactions ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-line bg-panel p-4"><p className="font-serif text-4xl">{value}</p><p className="text-sm text-muted">{label}</p></div>;
}
