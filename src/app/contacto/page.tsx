"use client";

import { useState } from "react";

export default function ContactPage() {
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-serif text-5xl">Contacto</h1>
      <p className="mt-3 text-muted">El mensaje se guarda en la base de Mesa. No hay un buzón externo configurado.</p>
      <form className="mt-6 grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/public/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), message: form.get("message") }) });
        const data = await response.json();
        setMessage(response.ok ? "Mensaje recibido." : data.error);
      }}>
        <input name="name" required placeholder="Nombre" className="rounded-xl border border-line px-3 py-2" />
        <input name="email" type="email" required placeholder="Correo" className="rounded-xl border border-line px-3 py-2" />
        <textarea name="message" required minLength={10} placeholder="Mensaje" className="min-h-32 rounded-xl border border-line px-3 py-2" />
        <button className="rounded-full bg-ink px-4 py-2 text-paper">Enviar</button>
        {message ? <p>{message}</p> : null}
      </form>
    </main>
  );
}
