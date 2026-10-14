"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link href="/" className="font-serif text-3xl">Mesa</Link>
      <h1 className="mt-8 font-serif text-5xl">Crear cuenta</h1>
      <form className="mt-8 grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password }) });
        const data = await response.json();
        if (!response.ok) { setError(data.error || "No se pudo crear."); return; }
        router.push("/escritorio");
        router.refresh();
      }}>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
        <label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
        <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" /></label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="rounded-full bg-ink px-4 py-3 text-paper">Crear escritorio</button>
      </form>
    </main>
  );
}
