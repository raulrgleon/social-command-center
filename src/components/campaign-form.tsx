"use client";

import { useState } from "react";

export function CampaignForm({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [voice, setVoice] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState(brands[0]?.id || "");
  const [message, setMessage] = useState("");

  return (
    <form className="mt-6 grid max-w-xl gap-3" onSubmit={async (event) => {
      event.preventDefault();
      const response = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, brandId: brandId || null, brandName, voice }) });
      const data = await response.json();
      setMessage(response.ok ? "Campaña guardada. Recarga para verla." : data.error);
    }}>
      <input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Nueva marca" className="rounded-xl border border-line bg-panel px-3 py-2" />
      <input value={voice} onChange={(event) => setVoice(event.target.value)} placeholder="Voz editorial" className="rounded-xl border border-line bg-panel px-3 py-2" />
      <select aria-label="Marca existente" value={brandId} onChange={(event) => setBrandId(event.target.value)} className="rounded-xl border border-line bg-panel px-3 py-2">
        <option value="">Sin marca previa</option>
        {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
      </select>
      <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre de la campaña" className="rounded-xl border border-line bg-panel px-3 py-2" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Para qué es" className="min-h-24 rounded-xl border border-line bg-panel px-3 py-2" />
      <button className="rounded-full bg-ink px-4 py-2 text-paper">Crear campaña</button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
