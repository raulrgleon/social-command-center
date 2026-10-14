"use client";

import { useEffect, useState } from "react";

export function SettingsForm() {
  const [timezone, setTimezone] = useState("America/Bogota");
  const [provider, setProvider] = useState("none");
  const [model, setModel] = useState("gpt-4o-mini");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings").then((response) => response.json()).then((data) => {
      setTimezone(data.timezone);
      setProvider(data.ai.provider);
      setModel(data.ai.model);
      setBaseUrl(data.ai.baseUrl);
      setHasKey(data.ai.hasKey);
    });
  }, []);

  return (
    <form className="mt-6 grid max-w-xl gap-3" onSubmit={async (event) => {
      event.preventDefault();
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timezone, provider, model, baseUrl, apiKey: apiKey || undefined }),
      });
      const data = await response.json();
      setMessage(response.ok ? "Ajustes guardados. La clave no se vuelve a mostrar." : data.error);
      if (response.ok && apiKey) { setHasKey(true); setApiKey(""); }
    }}>
      <label>Zona horaria<input value={timezone} onChange={(event) => setTimezone(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
      <label>Proveedor de IA
        <select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2">
          <option value="none">Asistente local</option>
          <option value="openai">OpenAI</option>
          <option value="compatible">Compatible con OpenAI</option>
        </select>
      </label>
      <label>Modelo<input value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
      <label>URL base, si no es OpenAI<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://…" className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
      <label>Clave del servidor<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={hasKey ? "Hay una clave guardada" : "sk-…"} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
      <button className="rounded-full bg-ink px-4 py-2 text-paper">Guardar</button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
